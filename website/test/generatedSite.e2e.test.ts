import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium, type Browser, type Locator } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const websiteRoot = fileURLToPath(new URL('..', import.meta.url))
const generatedRoot = join(websiteRoot, '.output/public')
const iconLoadFailure = '[Icon] failed to load icon `material-symbols-light:language`'
const ansiEscape = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')
const generateEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('VITEST')),
)
generateEnvironment.NODE_ENV = 'production'

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

async function expectRenderableIcon(icon: Locator) {
  const rendering = await icon.evaluate((element) => {
    const style = getComputedStyle(element)
    const svg = element.matches('svg') ? element : element.querySelector('svg')
    const imageSources = [
      style.backgroundImage,
      style.maskImage,
      style.getPropertyValue('-webkit-mask-image'),
      style.getPropertyValue('--svg'),
    ]
    const bounds = element.getBoundingClientRect()

    return {
      hasImageData: imageSources.some(source => source.includes('data:image/svg+xml')),
      hasSvgContent: Boolean(svg?.firstElementChild),
      height: bounds.height,
      width: bounds.width,
    }
  })

  expect(rendering.width).toBeGreaterThan(0)
  expect(rendering.height).toBeGreaterThan(0)
  expect(rendering.hasSvgContent || rendering.hasImageData).toBe(true)
}

describe('generated documentation website icons', () => {
  let browser: Browser
  let generateOutput = ''
  let server: ReturnType<typeof createServer>
  let staticSiteURL = ''

  beforeAll(async () => {
    const result = await execFileAsync(
      'pnpm',
      ['--filter', 'nuxt-content-mermaid-website', 'exec', 'nuxt', 'generate'],
      {
        cwd: repositoryRoot,
        env: generateEnvironment,
        maxBuffer: 16 * 1024 * 1024,
      },
    )
    generateOutput = `${result.stdout}\n${result.stderr}`.replace(ansiEscape, '')

    server = createServer(async (request, response) => {
      try {
        const requestURL = new URL(request.url ?? '/', 'http://127.0.0.1')
        let filePath = join(generatedRoot, decodeURIComponent(requestURL.pathname))
        if ((await stat(filePath)).isDirectory())
          filePath = join(filePath, 'index.html')

        response.writeHead(200, {
          'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
        })
        response.end(await readFile(filePath))
      }
      catch {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        response.end('Not Found')
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))

    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Expected the generated site server to use a TCP port')

    staticSiteURL = `http://127.0.0.1:${address.port}`
    browser = await chromium.launch()
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await new Promise<void>(resolve => server?.close(() => resolve()))
  })

  it('generates without the material language icon load failure', () => {
    expect(generateOutput).not.toContain(iconLoadFailure)
  })

  it('renders all site-control icons without a runtime icon provider', async () => {
    const blockedIconRequests: string[] = []
    const context = await browser.newContext({
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    await context.route('**/*', async (route) => {
      const requestURL = new URL(route.request().url())
      if (requestURL.origin !== staticSiteURL || requestURL.pathname.startsWith('/api/_nuxt_icon')) {
        blockedIconRequests.push(requestURL.href)
        await route.abort()
        return
      }
      await route.continue()
    })

    try {
      const page = await context.newPage()
      await page.goto(staticSiteURL, { waitUntil: 'networkidle' })
      await page.waitForSelector('button[aria-pressed]')

      await expectRenderableIcon(page.locator('[class~="i-line-md:sunny-outline"]'))
      await expectRenderableIcon(page.locator('[class~="i-line-md:sunny-outline-twotone-loop"]'))
      await expectRenderableIcon(page.locator('[class~="i-material-symbols-light:language"]'))

      await page.getByRole('button', { name: 'Switch to dark mode' }).click()
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')

      await expectRenderableIcon(page.locator('[class~="i-line-md:moon"]'))
      await expectRenderableIcon(page.locator('[class~="i-line-md:moon-twotone"]'))
      expect(blockedIconRequests).toEqual([])
    }
    finally {
      await context.close()
    }
  }, 30_000)
})
