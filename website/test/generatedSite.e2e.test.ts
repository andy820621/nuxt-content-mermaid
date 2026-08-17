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
const siteOrigin = 'https://nuxt-content-mermaid.barz.app'
const publicRoutes = [
  '/',
  '/getting-started',
  '/writing-diagrams',
  '/configuration',
  '/troubleshooting',
  '/migration/v3',
  '/zh',
  '/zh/getting-started',
  '/zh/writing-diagrams',
  '/zh/configuration',
  '/zh/troubleshooting',
  '/zh/migration/v3',
] as const
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

function generatedRouteFile(path: string) {
  return join(generatedRoot, ...path.split('/').filter(Boolean), 'index.html')
}

function normalizeText(text: string | null) {
  return text?.replace(/\s+/g, ' ').trim() ?? ''
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

describe('generated documentation website', () => {
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

  it('generates without icon load failures', () => {
    expect(generateOutput).not.toContain('[Icon] failed to load icon')
  })

  it('publishes the exact production routes through canonical links and sitemap', async () => {
    const page = await browser.newPage()

    try {
      for (const path of publicRoutes) {
        const response = await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'domcontentloaded' })

        expect(response?.status()).toBe(200)
        const canonical = page.locator('link[rel="canonical"]')
        expect(await canonical.count()).toBe(1)
        expect(await canonical.getAttribute('href'))
          .toBe(new URL(path, siteOrigin).href)
        expect(await page.locator('meta[property="og:url"]').getAttribute('content'))
          .toBe(new URL(path, siteOrigin).href)
      }

      const sitemap = await readFile(join(generatedRoot, 'sitemap.xml'), 'utf8')
      const sitemapURLs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map(([, url]) => url)

      expect(sitemapURLs).toEqual(publicRoutes.map(path => new URL(path, siteOrigin).href))
      expect(sitemap).not.toContain('/reference')
    }
    finally {
      await page.close()
    }
  }, 30_000)

  it('serves every public route from its own prerendered document before and after hydration', async () => {
    const noScriptContext = await browser.newContext({ javaScriptEnabled: false })
    const noScriptPage = await noScriptContext.newPage()
    const hydratedPage = await browser.newPage()
    const runtimeErrors: string[] = []
    const fallbackDocuments = await Promise.all([
      readFile(join(generatedRoot, '200.html'), 'utf8'),
      readFile(join(generatedRoot, '404.html'), 'utf8'),
    ])

    hydratedPage.on('console', (message) => {
      if (message.type() === 'error')
        runtimeErrors.push(message.text())
    })
    hydratedPage.on('pageerror', error => runtimeErrors.push(error.message))

    try {
      for (const path of publicRoutes) {
        const generatedHTML = await readFile(generatedRouteFile(path), 'utf8')

        expect(generatedHTML).toContain('<main')
        expect(fallbackDocuments).not.toContain(generatedHTML)

        const noScriptResponse = await noScriptPage.goto(`${staticSiteURL}${path}`, {
          waitUntil: 'domcontentloaded',
        })
        expect(noScriptResponse?.status()).toBe(200)
        const prerenderedHeading = normalizeText(
          await noScriptPage.locator('#main-content h1').textContent(),
        )
        expect(prerenderedHeading.length).toBeGreaterThan(0)
        expect(await noScriptPage.locator('link[rel="canonical"]').getAttribute('href'))
          .toBe(new URL(path, siteOrigin).href)

        const hydratedResponse = await hydratedPage.goto(`${staticSiteURL}${path}`, {
          waitUntil: 'networkidle',
        })
        expect(hydratedResponse?.status()).toBe(200)
        expect(new URL(hydratedPage.url()).pathname).toBe(path)
        expect(normalizeText(await hydratedPage.locator('#main-content h1').textContent()))
          .toBe(prerenderedHeading)
      }

      expect(runtimeErrors).toEqual([])
    }
    finally {
      await noScriptContext.close()
      await hydratedPage.close()
    }
  }, 60_000)

  it('keeps internal links and fragments inside the public route manifest', async () => {
    const page = await browser.newPage({ javaScriptEnabled: false })
    const routeIDs = new Map<string, Set<string>>()
    const internalLinks: URL[] = []

    try {
      for (const path of publicRoutes) {
        await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'domcontentloaded' })
        routeIDs.set(path, new Set(await page.locator('[id]').evaluateAll(
          elements => elements.map(element => element.id),
        )))

        const hrefs = await page.locator('a[href]').evaluateAll(
          links => links.map(link => link.getAttribute('href')).filter((href): href is string => Boolean(href)),
        )
        for (const href of hrefs) {
          if (href.startsWith('/') || href.startsWith('#'))
            internalLinks.push(new URL(href, new URL(path, siteOrigin)))
        }
      }

      for (const link of internalLinks) {
        expect(publicRoutes).toContain(link.pathname)
        if (link.hash)
          expect(routeIDs.get(link.pathname)).toContain(decodeURIComponent(link.hash.slice(1)))
      }
    }
    finally {
      await page.close()
    }
  }, 30_000)

  it('advertises safe package, repository, and license links', async () => {
    const page = await browser.newPage({ javaScriptEnabled: false })
    const requiredURLs = [
      'https://www.npmjs.com/package/@barzhsieh/nuxt-content-mermaid',
      'https://github.com/andy820621/nuxt-content-mermaid',
      'https://github.com/andy820621/nuxt-content-mermaid/blob/main/LICENSE',
    ]

    try {
      const externalLinks: Array<{ href: string | null, rel: string | null, target: string | null }> = []

      for (const path of publicRoutes) {
        await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'domcontentloaded' })
        externalLinks.push(...await page.locator('a[href^="http"]').evaluateAll(links => links.map(link => ({
          href: link.getAttribute('href'),
          rel: link.getAttribute('rel'),
          target: link.getAttribute('target'),
        }))))
      }

      expect([...new Set(externalLinks.map(link => link.href))])
        .toEqual(expect.arrayContaining(requiredURLs))

      for (const link of externalLinks) {
        expect(new URL(link.href ?? '').protocol).toBe('https:')
        if (link.target === '_blank')
          expect(link.rel?.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer'])
      }
    }
    finally {
      await page.close()
    }
  })

  it('renders project ownership and license in the shared footer', async () => {
    const page = await browser.newPage()

    try {
      for (const path of ['/', '/getting-started']) {
        await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'networkidle' })

        const footer = page.getByRole('contentinfo')
        await expect.poll(() => footer.count()).toBe(1)
        expect((await footer.textContent())?.replace(/\s+/g, ' ').trim())
          .toBe('© 2025–present BarZ Hsieh · MIT License')
        expect(await footer.getByRole('link', { name: 'BarZ Hsieh' }).getAttribute('href'))
          .toBe('https://github.com/andy820621')
        expect(await footer.getByRole('link', { name: 'MIT License' }).getAttribute('href'))
          .toBe('https://github.com/andy820621/nuxt-content-mermaid/blob/main/LICENSE')
      }
    }
    finally {
      await page.close()
    }
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

      const switcher = page.getByRole('link', { name: 'Switch to Chinese' })
      expect(await switcher.textContent()).toBe('中')
      expect(await switcher.locator('.iconify').count()).toBe(0)

      await expectRenderableIcon(page.locator('[class~="i-line-md:sunny-outline"]'))
      await expectRenderableIcon(page.locator('[class~="i-line-md:sunny-outline-twotone-loop"]'))

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
