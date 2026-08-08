import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'

const HOST = '127.0.0.1'
const STARTUP_TIMEOUT_MS = 60_000
const BROWSER_TIMEOUT_MS = 60_000
const PROCESS_LOG_LIMIT = 8_000

async function availablePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, HOST, resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : undefined
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  if (!port) throw new Error('Could not reserve a port for the production server')
  return port
}

function appendLogTail(current, chunk) {
  return `${current}${String(chunk)}`.slice(-PROCESS_LOG_LIMIT)
}

async function waitForServer(url, processState) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  let lastProbe = 'no response received'
  while (Date.now() < deadline) {
    if (processState.spawnError) throw processState.spawnError
    if (processState.exited) {
      throw new Error(
        `Production server exited before startup (${processState.exitDescription})\n${processState.logs}`,
      )
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (response.ok) return
      const body = (await response.text()).trim().slice(0, 1_000)
      lastProbe = `HTTP ${response.status} ${response.statusText}${body ? `: ${body}` : ''}`
    }
    catch (error) {
      lastProbe = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    }
    await delay(250)
  }
  throw new Error(
    `Production server did not become ready within ${STARTUP_TIMEOUT_MS}ms\nLast readiness probe: ${lastProbe}\n${processState.logs}`,
  )
}

async function stopServer(serverProcess, processState, exitPromise) {
  if (processState.exited) return
  serverProcess.kill('SIGTERM')
  await Promise.race([exitPromise, delay(5_000)])
  if (!processState.exited) {
    serverProcess.kill('SIGKILL')
    await exitPromise
  }
}

export async function runBrowserSmoke({ consumerDirectory }) {
  const port = await availablePort()
  const url = `http://${HOST}:${port}/`
  const serverProcess = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: consumerDirectory,
    env: {
      ...process.env,
      HOST,
      NITRO_HOST: HOST,
      NITRO_PORT: String(port),
      NODE_ENV: 'production',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const processState = {
    exited: false,
    exitDescription: 'unknown',
    logs: '',
    spawnError: null,
  }
  serverProcess.stdout.on('data', (chunk) => {
    processState.logs = appendLogTail(processState.logs, chunk)
  })
  serverProcess.stderr.on('data', (chunk) => {
    processState.logs = appendLogTail(processState.logs, chunk)
  })
  serverProcess.once('error', (error) => {
    processState.spawnError = error
  })
  const exitPromise = new Promise((resolve) => {
    serverProcess.once('exit', (code, signal) => {
      processState.exited = true
      processState.exitDescription = signal ? `signal ${signal}` : `exit code ${code}`
      resolve()
    })
  })

  let browser
  try {
    await waitForServer(url, processState)
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const fatalErrors = []
    page.on('pageerror', error => fatalErrors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') fatalErrors.push(`console: ${message.text()}`)
    })
    page.on('requestfailed', (request) => {
      if (['document', 'script'].includes(request.resourceType())) {
        fatalErrors.push(`request: ${request.url()} (${request.failure()?.errorText ?? 'failed'})`)
      }
    })

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: BROWSER_TIMEOUT_MS,
    })
    const svg = page.locator(
      '[data-release-mermaid-root] .mermaid-block .mermaid-wrapper > .mermaid > svg',
    ).first()
    await svg.waitFor({ state: 'visible', timeout: BROWSER_TIMEOUT_MS })
    const outcome = await svg.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const text = element.textContent ?? ''
      return {
        childCount: element.childElementCount,
        edgeCount: element.querySelectorAll('g.edgePaths path').length,
        hasArtifactLabel: text.includes('Publishable Package Artifact'),
        hasFlowchartClass: element.classList.contains('flowchart'),
        hasSvgLabel: text.includes('Visible Mermaid SVG'),
        height: rect.height,
        markupLength: element.innerHTML.trim().length,
        markerCount: element.querySelectorAll('marker').length,
        nodeCount: element.querySelectorAll('g.nodes g.node').length,
        width: rect.width,
      }
    })
    if (outcome.childCount === 0
      || outcome.markupLength === 0
      || outcome.width <= 0
      || outcome.height <= 0) {
      throw new Error(`Mermaid SVG is empty or not visible: ${JSON.stringify(outcome)}`)
    }
    if (!outcome.hasFlowchartClass
      || outcome.nodeCount < 2
      || outcome.edgeCount < 1
      || outcome.markerCount < 1
      || !outcome.hasArtifactLabel
      || !outcome.hasSvgLabel) {
      throw new Error(`Rendered SVG does not contain the expected Mermaid flowchart structure: ${JSON.stringify(outcome)}`)
    }
    if (fatalErrors.length > 0) {
      throw new Error(`Fatal browser errors blocked the runtime path:\n${fatalErrors.join('\n')}`)
    }
  }
  catch (error) {
    const logs = processState.logs ? `\nProduction server log tail:\n${processState.logs}` : ''
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${message}${logs}`)
  }
  finally {
    await browser?.close()
    await stopServer(serverProcess, processState, exitPromise)
  }
}
