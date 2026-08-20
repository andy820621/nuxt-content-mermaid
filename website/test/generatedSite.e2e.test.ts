import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify, stripVTControlCharacters } from 'node:util'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PUBLIC_ROUTES, SITE_NAME, SITE_ORIGIN } from '../utils/site'

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const websiteRoot = fileURLToPath(new URL('..', import.meta.url))
const generatedRoot = join(websiteRoot, '.output/public')
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
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

function generatedRouteFile(path: string) {
  if (path === '/')
    return join(generatedRoot, 'index.html')

  return join(generatedRoot, `${path.slice(1)}.html`)
}

function markdownRouteFor(path: string) {
  return path === '/' ? '/index.md' : `${path}.md`
}

function normalizeText(text: string | null) {
  return text?.replace(/\s+/g, ' ').trim() ?? ''
}

function localizedRoutePair(path: string) {
  const englishPath = path === '/zh'
    ? '/'
    : path.startsWith('/zh/')
      ? path.slice(3)
      : path
  const chinesePath = englishPath === '/' ? '/zh' : `/zh${englishPath}`

  return {
    'en-US': new URL(englishPath, SITE_ORIGIN).href,
    'zh-TW': new URL(chinesePath, SITE_ORIGIN).href,
  }
}

interface SchemaNode {
  '@id'?: string
  '@type'?: string | string[]
  'description'?: string
  'inLanguage'?: string
  'isPartOf'?: string | { '@id'?: string }
  'name'?: string
  'url'?: string
}

function isSchemaNode(value: unknown): value is SchemaNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasSchemaType(node: SchemaNode, type: string) {
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
  return types.includes(type)
}

function schemaReferenceID(reference: SchemaNode['isPartOf']) {
  return typeof reference === 'string' ? reference : reference?.['@id']
}

async function schemaNodes(page: Page) {
  const sources = await page.locator('script[type="application/ld+json"]').allTextContents()

  return sources.flatMap((source) => {
    const document: unknown = JSON.parse(source)
    if (!isSchemaNode(document))
      return []

    const graph = (document as Record<string, unknown>)['@graph']
    return Array.isArray(graph) ? graph.filter(isSchemaNode) : [document]
  })
}

async function metaContents(page: Page, selector: string) {
  return page.locator(selector).evaluateAll(elements => (
    elements.map(element => element.getAttribute('content'))
  ))
}

interface RobotsGroup {
  userAgents: string[]
  directives: Map<string, string[]>
}

function parseRobotsDirective(rawLine: string) {
  const line = rawLine.replace(/#.*$/, '').trim()
  const separator = line.indexOf(':')

  if (!line || separator === -1)
    return

  return {
    name: line.slice(0, separator).trim().toLowerCase(),
    value: line.slice(separator + 1).trim(),
  }
}

function parseRobotsGroups(source: string): RobotsGroup[] {
  const groups: RobotsGroup[] = []
  let current: RobotsGroup | undefined

  for (const rawLine of source.split(/\r?\n/)) {
    const directive = parseRobotsDirective(rawLine)
    if (!directive)
      continue

    const { name } = directive
    const value = directive.value.toLowerCase()

    if (name === 'user-agent') {
      if (!current || current.directives.size > 0) {
        current = { userAgents: [], directives: new Map() }
        groups.push(current)
      }
      current.userAgents.push(value)
      continue
    }

    if (!current)
      continue

    const values = current.directives.get(name) ?? []
    values.push(value)
    current.directives.set(name, values)
  }

  return groups
}

function robotsGroupFor(groups: RobotsGroup[], userAgent: string) {
  const normalizedAgent = userAgent.toLowerCase()
  return groups.find(group => group.userAgents.includes(normalizedAgent))
    ?? groups.find(group => group.userAgents.includes('*'))
}

function directivePreferences(group: RobotsGroup, directive: string) {
  return (group.directives.get(directive) ?? [])
    .flatMap(value => value.split(',').map(preference => preference.trim()))
}

function robotsDirectiveValues(source: string, directive: string) {
  return source.split(/\r?\n/).flatMap((rawLine) => {
    const parsedDirective = parseRobotsDirective(rawLine)
    if (!parsedDirective || parsedDirective.name !== directive)
      return []

    return [parsedDirective.value]
  })
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
    generateOutput = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`)

    server = createServer(async (request, response) => {
      try {
        const requestURL = new URL(request.url ?? '/', 'http://127.0.0.1')
        const pathname = decodeURIComponent(requestURL.pathname)
        const htmlPath = pathname === '/'
          ? join(generatedRoot, 'index.html')
          : join(generatedRoot, `${pathname.slice(1).replace(/\/$/, '')}.html`)
        let filePath = htmlPath

        try {
          await stat(htmlPath)

          if (pathname !== '/' && pathname.endsWith('/')) {
            response.writeHead(308, {
              location: `${requestURL.pathname.slice(0, -1)}${requestURL.search}`,
            })
            response.end()
            return
          }
        }
        catch {
          filePath = join(generatedRoot, pathname)
          if ((await stat(filePath)).isDirectory()) {
            if (!pathname.endsWith('/')) {
              response.writeHead(308, { location: `${requestURL.pathname}/${requestURL.search}` })
              response.end()
              return
            }

            filePath = join(filePath, 'index.html')
          }
        }

        const body = await readFile(filePath)
        response.writeHead(200, {
          'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
        })
        response.end(body)
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

  it('publishes the exact production routes and crawler policy', async () => {
    const page = await browser.newPage()

    try {
      for (const path of PUBLIC_ROUTES) {
        const response = await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'domcontentloaded' })
        const expectedLocale = path === '/zh' || path.startsWith('/zh/') ? 'zh-TW' : 'en-US'

        expect(response?.status()).toBe(200)
        const canonical = page.locator('link[rel="canonical"]')
        expect(await canonical.count()).toBe(1)
        expect(await canonical.getAttribute('href'))
          .toBe(new URL(path, SITE_ORIGIN).href)
        expect(await page.locator('meta[property="og:url"]').getAttribute('content'))
          .toBe(new URL(path, SITE_ORIGIN).href)
        expect(await page.locator('html').getAttribute('lang')).toBe(expectedLocale)
        const title = await page.title()
        expect(title).not.toBe('')
        expect(title.endsWith(` · ${SITE_NAME}`)).toBe(true)
        expect(await page.locator('meta[property="og:locale"]').getAttribute('content'))
          .toBe(expectedLocale.replace('-', '_'))

        for (const [language, href] of Object.entries(localizedRoutePair(path))) {
          const alternate = page.locator(`link[rel="alternate"][hreflang="${language}"]`)
          expect(await alternate.count()).toBe(1)
          expect(await alternate.getAttribute('href')).toBe(href)
        }
      }

      const sitemap = await readFile(join(generatedRoot, 'sitemap.xml'), 'utf8')
      const expectedSitemapURLs = PUBLIC_ROUTES.map(path => new URL(path, SITE_ORIGIN).href)
      const sitemapURLs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map(([, url]) => url)

      expect(sitemap).not.toContain('<sitemapindex')
      expect(sitemapURLs).toHaveLength(expectedSitemapURLs.length)
      expect(new Set(sitemapURLs).size).toBe(expectedSitemapURLs.length)
      expect(new Set(sitemapURLs)).toEqual(new Set(expectedSitemapURLs))
      expect(sitemap).not.toContain('/reference')

      const robots = await readFile(join(generatedRoot, 'robots.txt'), 'utf8')
      const groups = parseRobotsGroups(robots)
      const wildcardGroup = robotsGroupFor(groups, '*')

      expect(wildcardGroup?.directives.get('allow')).toContain('/')
      expect(robotsDirectiveValues(robots, 'sitemap'))
        .toEqual([`${SITE_ORIGIN}/sitemap.xml`])

      for (const userAgent of ['GPTBot', 'ClaudeBot', 'CCBot', 'Applebot-Extended']) {
        expect(robotsGroupFor(groups, userAgent)?.directives.get('disallow')).toContain('/')
      }

      for (const userAgent of [
        'OAI-SearchBot',
        'ChatGPT-User',
        'Claude-SearchBot',
        'Claude-User',
        'PerplexityBot',
        'Googlebot',
        'Bingbot',
        'Applebot',
        'Google-Extended',
      ]) {
        expect(robotsGroupFor(groups, userAgent)?.directives.get('disallow') ?? []).not.toContain('/')
      }

      expect(directivePreferences(wildcardGroup!, 'content-signal'))
        .toEqual(expect.arrayContaining(['search=yes', 'ai-input=yes', 'ai-train=no']))
      expect(directivePreferences(wildcardGroup!, 'content-usage'))
        .toEqual(expect.arrayContaining(['bots=y', 'search=y', 'ai-output=y', 'train-ai=n']))
    }
    finally {
      await page.close()
    }
  }, 30_000)

  it('derives consistent social metadata and structured data from each documentation page', async () => {
    const page = await browser.newPage({ javaScriptEnabled: false })
    const expectedSocialImage = `${SITE_ORIGIN}/assets/nuxt-content-mermaid.png`
    const siteDescriptions = {
      'en-US': 'Turn Mermaid code blocks into interactive diagrams without leaving your Markdown workflow.',
      'zh-TW': '不離開 Markdown 工作流程，將 Mermaid 程式碼區塊轉換為互動式圖表。',
    } as const

    try {
      for (const path of PUBLIC_ROUTES) {
        await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'domcontentloaded' })

        const expectedLocale = path === '/zh' || path.startsWith('/zh/') ? 'zh-TW' : 'en-US'
        const canonicalURL = new URL(path, SITE_ORIGIN).href
        const title = await page.title()
        const pageTitle = title.slice(0, -` · ${SITE_NAME}`.length)
        const description = await page.locator('meta[name="description"]').getAttribute('content')

        expect(description).not.toBeNull()
        expect(await metaContents(page, 'meta[property="og:title"]')).toEqual([title])
        expect(await metaContents(page, 'meta[property="og:description"]')).toEqual([description])
        expect(await metaContents(page, 'meta[name="twitter:title"]')).toEqual([pageTitle])
        expect(await metaContents(page, 'meta[name="twitter:description"]')).toEqual([description])
        expect(await metaContents(page, 'meta[property="og:image"]')).toEqual([expectedSocialImage])
        expect(await metaContents(page, 'meta[property="og:image:alt"]')).toEqual([SITE_NAME])
        expect(await metaContents(page, 'meta[name="twitter:card"]')).toEqual(['summary_large_image'])
        expect(await metaContents(page, 'meta[name="twitter:image"]')).toEqual([expectedSocialImage])
        expect(await metaContents(page, 'meta[name="twitter:image:alt"]')).toEqual([SITE_NAME])

        const nodes = await schemaNodes(page)
        const matchingPages = nodes.filter(node => hasSchemaType(node, 'WebPage') && node.url === canonicalURL)
        expect(matchingPages).toHaveLength(1)

        const webPage = matchingPages[0]!
        expect(webPage.description).toBe(description)
        expect(webPage.inLanguage).toBe(expectedLocale)

        const webSiteID = schemaReferenceID(webPage.isPartOf)
        const webSite = nodes.find(node => hasSchemaType(node, 'WebSite') && node['@id'] === webSiteID)
        expect(webSite).toBeDefined()
        expect(webSite?.name).toBe(SITE_NAME)
        expect(webSite?.description).toBe(siteDescriptions[expectedLocale])
        expect(webSite?.inLanguage).toBe(expectedLocale)
        expect(webSite?.url).toBe(expectedLocale === 'zh-TW' ? `${SITE_ORIGIN}/zh` : `${SITE_ORIGIN}/`)
      }
    }
    finally {
      await page.close()
    }
  }, 30_000)

  it('publishes AI-readable Markdown and LLM indexes without widening the sitemap', async () => {
    const page = await browser.newPage({ javaScriptEnabled: false })

    try {
      for (const path of PUBLIC_ROUTES) {
        await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'domcontentloaded' })
        const heading = normalizeText(await page.locator('#main-content h1').textContent())
        const markdownPath = markdownRouteFor(path)
        const markdownAlternateHrefs = await page
          .locator('link[rel="alternate"][type="text/markdown"]')
          .evaluateAll(links => links.map(link => link.getAttribute('href')))

        expect(markdownAlternateHrefs).toHaveLength(1)
        expect(new URL(markdownAlternateHrefs[0]!, SITE_ORIGIN).pathname).toBe(markdownPath)

        const markdownResponse = await fetch(`${staticSiteURL}${markdownPath}`)
        const markdown = await markdownResponse.text()

        expect(markdownResponse.status).toBe(200)
        expect(markdown).toContain(heading)
        expect(markdown).not.toMatch(/<!doctype html|<html(?:\s|>)|__NUXT__|<script[^>]+src=["'][^"']*\/_nuxt\//i)
      }

      const llmsResponse = await fetch(`${staticSiteURL}/llms.txt`)
      const llms = await llmsResponse.text()

      expect(llmsResponse.status).toBe(200)
      expect(llms).toContain(`# ${SITE_NAME}`)
      expect(llms).toContain('Turn Mermaid code blocks into interactive diagrams without leaving your Markdown workflow.')
      expect(llms).toContain('/llms-full.txt')
      expect(llms).toContain('/index.md')
      expect(llms).toContain('/getting-started.md')
      expect(llms).toContain('/zh.md')
      expect(llms).toMatch(/繁體中文|Traditional Chinese/)

      const llmsFullResponse = await fetch(`${staticSiteURL}/llms-full.txt`)
      const llmsFull = await llmsFullResponse.text()

      expect(llmsFullResponse.status).toBe(200)
      expect(llmsFull).toContain('Install Nuxt Content Mermaid')
      expect(llmsFull).toContain('安裝 Nuxt Content Mermaid')
      expect(llmsFull).not.toContain('This file is generated during prerender.')
      expect(llmsFull).not.toMatch(/<!doctype html|<html(?:\s|>)|__NUXT__|<script[^>]+src=["'][^"']*\/_nuxt\//i)

      const sitemap = await readFile(join(generatedRoot, 'sitemap.xml'), 'utf8')
      expect(sitemap).not.toContain('.md</loc>')
      expect(sitemap).not.toContain('/llms.txt</loc>')
      expect(sitemap).not.toContain('/llms-full.txt</loc>')
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
      for (const path of PUBLIC_ROUTES) {
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
          .toBe(new URL(path, SITE_ORIGIN).href)

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
      for (const path of PUBLIC_ROUTES) {
        await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'domcontentloaded' })
        routeIDs.set(path, new Set(await page.locator('[id]').evaluateAll(
          elements => elements.map(element => element.id),
        )))

        const hrefs = await page.locator('a[href]').evaluateAll(
          links => links.map(link => link.getAttribute('href')).filter((href): href is string => Boolean(href)),
        )
        for (const href of hrefs) {
          if (href.startsWith('/') || href.startsWith('#'))
            internalLinks.push(new URL(href, new URL(path, SITE_ORIGIN)))
        }
      }

      for (const link of internalLinks) {
        expect(PUBLIC_ROUTES).toContain(link.pathname)
        if (link.hash)
          expect(routeIDs.get(link.pathname)).toContain(decodeURIComponent(link.hash.slice(1)))
      }
    }
    finally {
      await page.close()
    }
  }, 30_000)

  it('renders project ownership and license in the shared footer', async () => {
    const page = await browser.newPage()
    const footerLinks = [
      { href: 'https://github.com/andy820621', name: 'BarZ Hsieh' },
      {
        href: 'https://github.com/andy820621/nuxt-content-mermaid/blob/main/LICENSE',
        name: 'MIT License',
      },
    ] as const

    try {
      for (const path of ['/', '/getting-started']) {
        await page.goto(`${staticSiteURL}${path}`, { waitUntil: 'networkidle' })

        const footer = page.getByRole('contentinfo')
        await expect.poll(() => footer.count()).toBe(1)
        expect((await footer.textContent())?.replace(/\s+/g, ' ').trim())
          .toBe('© 2025–present BarZ Hsieh · MIT License')

        for (const { href, name } of footerLinks) {
          const link = footer.getByRole('link', { name })

          expect(await link.getAttribute('href')).toBe(href)
          expect(await link.getAttribute('target')).toBe('_blank')
          expect((await link.getAttribute('rel'))?.split(/\s+/).sort())
            .toEqual(['noopener', 'noreferrer'])
        }
      }
    }
    finally {
      await page.close()
    }
  })
})
