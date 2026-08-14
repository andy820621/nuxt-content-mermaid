import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { readFile, readdir, stat } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { WEBSITE_STATIC_CASES } from './adoption.mjs'

const IGNORED_PROVIDER_HTML = new Set(['200.html', '404.html'])
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}
const DEFAULT_REPOSITORY_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

export { WEBSITE_STATIC_CASES }

function isWithin(parent, candidate) {
  const child = relative(parent, candidate)
  return child === '' || (!child.startsWith('..') && !isAbsolute(child))
}

async function listFiles(directory, root = directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(path, root))
    else if (entry.isFile()) files.push(relative(root, path).replaceAll(sep, '/'))
  }
  return files
}

function logicalRouteForHtml(physicalFile) {
  if (physicalFile === 'index.html') return '/'
  if (physicalFile.endsWith('/index.html')) return `/${physicalFile.slice(0, -'/index.html'.length)}`
  if (physicalFile.endsWith('.html')) return `/${physicalFile.slice(0, -'.html'.length)}`
  return null
}

export async function buildGeneratedRouteManifest({ publicDirectory, allowedLogicalRoutes }) {
  const groups = new Map()
  const htmlFiles = (await listFiles(publicDirectory))
    .filter(file => file.endsWith('.html') && !IGNORED_PROVIDER_HTML.has(file))
    .sort()

  for (const physicalFile of htmlFiles) {
    const logicalRoute = logicalRouteForHtml(physicalFile)
    if (!allowedLogicalRoutes.includes(logicalRoute)) {
      throw new Error(`Generated output contains an undeclared authored route: ${logicalRoute}`)
    }
    const physicalFiles = groups.get(logicalRoute) ?? []
    physicalFiles.push(physicalFile)
    groups.set(logicalRoute, physicalFiles)
  }

  for (const route of allowedLogicalRoutes) {
    if (!groups.has(route)) throw new Error(`Generated output is missing authored route: ${route}`)
  }

  return allowedLogicalRoutes.map(logicalRoute => ({
    logicalRoute,
    physicalFiles: groups.get(logicalRoute),
  }))
}

export async function createPlainStaticServer({ publicDirectory, directRoutes }) {
  const root = resolve(publicDirectory)
  const requestLog = []
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const record = {
      method: request.method,
      url: url.pathname,
      status: 404,
      physicalFile: null,
      fallback: false,
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      record.status = 405
      requestLog.push(record)
      response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Method Not Allowed')
      return
    }

    let physicalFile = directRoutes[url.pathname]
    if (!physicalFile && extname(url.pathname)) {
      try {
        physicalFile = decodeURIComponent(url.pathname).replace(/^\/+/, '')
      }
      catch {
        physicalFile = undefined
      }
    }
    const filePath = physicalFile ? resolve(root, physicalFile) : null

    try {
      if (!filePath || !isWithin(root, filePath) || !(await stat(filePath)).isFile()) {
        throw new Error('not found')
      }
      record.status = 200
      record.physicalFile = relative(root, filePath).replaceAll(sep, '/')
      requestLog.push(record)
      response.writeHead(200, {
        'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
      })
      if (request.method === 'HEAD') response.end()
      else createReadStream(filePath).pipe(response)
    }
    catch {
      requestLog.push(record)
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end('Not Found')
    }
  })

  await new Promise((resolveListening, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListening)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Plain static server did not expose a TCP address')
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests: () => requestLog.map(record => ({ ...record })),
    close: () => new Promise((resolveClose, reject) => {
      server.close(error => error ? reject(error) : resolveClose())
    }),
  }
}

export function classifyRequestFailure({ javaScriptEnabled, resourceType, failure }) {
  return typeof failure === 'string'
    && failure.toLowerCase() === 'csp'
    && !javaScriptEnabled
    && resourceType === 'script'
    ? 'expected-script-cancellation'
    : 'blocking'
}

export async function closeVerificationResources({ browser, server }) {
  const closeOperations = [
    browser && (() => browser.close()),
    () => server.close(),
  ].filter(Boolean)
  const results = await Promise.allSettled(
    closeOperations.map(close => Promise.resolve().then(close)),
  )
  const failures = results
    .filter(result => result.status === 'rejected')
    .map(result => result.reason)

  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, 'website verification cleanup failed')
}

function expectObservation(condition, message) {
  if (!condition) throw new Error(`website static-site verification failed: ${message}`)
}

function capturePageBoundary({ page, origin, javaScriptEnabled, boundary }) {
  page.on('console', (message) => {
    if (message.type() === 'error' || /hydration (?:mismatch|completed but contains mismatches)/i.test(message.text())) {
      boundary.errors.push(`console ${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', error => boundary.errors.push(`page error: ${error.message}`))
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== origin) {
      boundary.errors.push(`unexpected external runtime request: ${request.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown failure'
    const classification = classifyRequestFailure({
      javaScriptEnabled,
      resourceType: request.resourceType(),
      failure,
    })
    if (classification === 'expected-script-cancellation') {
      boundary.cancellations.push({ url: request.url(), failure })
    }
    else {
      boundary.errors.push(`request failed: ${request.url()} (${failure})`)
    }
  })
  page.on('response', (response) => {
    const request = response.request()
    const record = {
      url: response.url(),
      status: response.status(),
      resourceType: request.resourceType(),
      redirected: Boolean(request.redirectedFrom()),
    }
    boundary.responses.push(record)
    if (record.status >= 400) boundary.errors.push(`HTTP ${record.status}: ${record.url}`)
    if (record.redirected || (record.status >= 300 && record.status < 400)) {
      boundary.errors.push(`unexpected redirect: ${record.url}`)
    }
  })
}

async function assertCommonPage(page, routeCase, hydrationState) {
  expectObservation(await page.title() === routeCase.title, `${routeCase.id} title mismatch`)
  expectObservation(
    await page.locator('meta[name="description"]').getAttribute('content') === routeCase.description,
    `${routeCase.id} description mismatch`,
  )
  expectObservation(
    await page.locator('h1').filter({ hasText: routeCase.heading }).count() === 1,
    `${routeCase.id} heading mismatch`,
  )
  expectObservation(
    await page.locator(`nav a[href="${routeCase.navigationHref}"]`).count() === 1,
    `${routeCase.id} navigation mismatch`,
  )
  const root = page.locator(`[data-page-id="${routeCase.id}"]`)
  expectObservation(await root.count() === 1, `${routeCase.id} page identity mismatch`)
  expectObservation(
    await root.getAttribute('data-hydration-state') === hydrationState,
    `${routeCase.id} hydration state mismatch`,
  )
}

async function observeWithoutJavaScript({ browser, server, routeCase, boundary }) {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  capturePageBoundary({
    page,
    origin: server.origin,
    javaScriptEnabled: false,
    boundary,
  })
  try {
    const response = await page.goto(`${server.origin}${routeCase.directUrl}`, { waitUntil: 'load' })
    expectObservation(response?.status() === 200, `${routeCase.id} direct no-JavaScript load was not 200`)
    expectObservation(page.url() === `${server.origin}${routeCase.directUrl}`, `${routeCase.id} direct URL changed`)
    await assertCommonPage(page, routeCase, 'prerendered')

    let artifactVersion
    if (routeCase.contractSource) {
      const primaryDemo = page.locator('[data-contract-demo="primary"]')
      const source = primaryDemo.locator('[data-contract-source]')
      expectObservation(await source.count() === 1, `${routeCase.id} disclosure must be unique`)
      expectObservation(await source.isVisible(), `${routeCase.id} disclosure is not visible`)
      expectObservation((await source.textContent())?.trim() === routeCase.contractSource.trim(), `${routeCase.id} disclosure source mismatch`)
      const selected = await source.evaluate((element) => {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(element)
        selection?.removeAllRanges()
        selection?.addRange(range)
        return selection?.toString().trim()
      })
      expectObservation(selected === routeCase.contractSource.trim(), `${routeCase.id} disclosure is not programmatically selectable`)
      artifactVersion = await primaryDemo.locator('[data-artifact-version]').getAttribute('data-artifact-version')
      expectObservation(artifactVersion === routeCase.artifactVersion, `${routeCase.id} artifact disclosure mismatch`)
    }
    const observation = routeCase.observeNoJavaScript
      ? await routeCase.observeNoJavaScript({ page, origin: server.origin })
      : {}
    return { artifactVersion, observation }
  }
  finally {
    await context.close()
  }
}

async function observeWithJavaScript({ browser, server, routeCase, boundary }) {
  const context = await browser.newContext({ javaScriptEnabled: true })
  const page = await context.newPage()
  capturePageBoundary({
    page,
    origin: server.origin,
    javaScriptEnabled: true,
    boundary,
  })
  try {
    const response = await page.goto(`${server.origin}${routeCase.directUrl}`, { waitUntil: 'load' })
    expectObservation(response?.status() === 200, `${routeCase.id} direct JavaScript load was not 200`)
    expectObservation(page.url() === `${server.origin}${routeCase.directUrl}`, `${routeCase.id} hydrated URL changed`)
    await page.locator(`[data-page-id="${routeCase.id}"][data-hydration-state="hydrated"]`).waitFor()
    await assertCommonPage(page, routeCase, 'hydrated')

    let svgCount
    if (routeCase.contractSource) {
      const svg = page.locator('[data-contract-demo="primary"] [data-contract-diagram] .mermaid > svg')
      await svg.waitFor()
      svgCount = await svg.count()
      expectObservation(svgCount === 1 && await svg.isVisible(), `${routeCase.id} must expose one visible Mermaid SVG`)
    }
    const observation = routeCase.observeHydrated
      ? await routeCase.observeHydrated({ page, origin: server.origin })
      : {}
    return { svgCount, observation }
  }
  finally {
    await context.close()
  }
}

export async function runStaticSiteVerification({
  publicDirectory,
  cases,
  allowedLogicalRoutes = cases.map(routeCase => routeCase.logicalRoute),
  launchBrowser = () => chromium.launch({ headless: true }),
  startServer = createPlainStaticServer,
}) {
  const manifest = await buildGeneratedRouteManifest({
    publicDirectory,
    allowedLogicalRoutes,
  })
  const directRoutes = Object.fromEntries(cases.map(routeCase => [routeCase.directUrl, routeCase.physicalFile]))
  const server = await startServer({ publicDirectory, directRoutes })
  let browser
  const boundary = {
    errors: [],
    responses: [],
    cancellations: [],
  }

  try {
    browser = await launchBrowser()
    const routes = []
    for (const routeCase of cases) {
      const noJavaScript = await observeWithoutJavaScript({
        browser,
        server,
        routeCase,
        boundary,
      })
      const hydrated = await observeWithJavaScript({
        browser,
        server,
        routeCase,
        boundary,
      })
      routes.push({
        id: routeCase.id,
        logicalRoute: routeCase.logicalRoute,
        directUrl: routeCase.directUrl,
        physicalFile: routeCase.physicalFile,
        prerendered: true,
        hydrated: true,
        noJavaScript: true,
        observations: {
          noJavaScript: noJavaScript.observation,
          hydrated: hydrated.observation,
        },
        ...(noJavaScript.artifactVersion ? { artifactVersion: noJavaScript.artifactVersion } : {}),
        ...(hydrated.svgCount ? { svgCount: hydrated.svgCount } : {}),
      })
    }

    const requests = server.requests()
    for (const request of requests) {
      if (request.status !== 200 || request.fallback || !request.physicalFile) {
        boundary.errors.push(`static request boundary failure: ${request.method} ${request.url} -> ${request.status}`)
      }
    }
    expectObservation(boundary.errors.length === 0, boundary.errors.join('; '))

    return {
      phase: 'static-site',
      manifest,
      routes,
      requestBoundary: {
        requestCount: requests.length,
        uniqueStaticFiles: new Set(requests.flatMap(request => request.physicalFile ?? [])).size,
        directRouteRequests: requests.filter(request => cases.some(routeCase => routeCase.directUrl === request.url)),
        responseCount: boundary.responses.length,
        redirects: boundary.responses.filter(response => response.redirected).length,
        fallbacks: requests.filter(request => request.fallback).length,
        externalRequests: 0,
        failedRequests: 0,
      },
      noJavaScript: {
        expectedScriptCancellations: boundary.cancellations.length,
        reasons: [...new Set(boundary.cancellations.map(cancellation => cancellation.failure))],
      },
      errors: boundary.errors,
    }
  }
  finally {
    await closeVerificationResources({ browser, server })
  }
}

function selectCases(argv, cases) {
  if (argv.length === 0) return cases
  if (argv.length !== 2 || argv[0] !== '--case' || !argv[1]) {
    throw new Error('Usage: test:website-static -- --case <id>')
  }
  const selected = cases.filter(routeCase => routeCase.id === argv[1])
  if (selected.length !== 1) throw new Error(`Unknown website static case: ${argv[1]}`)
  return selected
}

export async function runWebsiteStaticCli({
  argv = process.argv.slice(2),
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  cases = WEBSITE_STATIC_CASES,
  verifier = runStaticSiteVerification,
} = {}) {
  const selectedCases = selectCases(argv, cases)
  const contractSource = cases === WEBSITE_STATIC_CASES
    ? (await readFile(join(repositoryRoot, 'assets/contract-demo/basic.mmd'), 'utf8')).trim()
    : null
  return verifier({
    publicDirectory: join(repositoryRoot, 'website/.output/public'),
    allowedLogicalRoutes: cases.map(routeCase => routeCase.logicalRoute),
    cases: selectedCases.map(routeCase => (
      routeCase.id === 'home' && contractSource
        ? { ...routeCase, contractSource }
        : routeCase
    )),
  })
}

async function main() {
  try {
    console.log(JSON.stringify(await runWebsiteStaticCli(), null, 2))
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
