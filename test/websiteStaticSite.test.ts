import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildGeneratedRouteManifest,
  classifyRequestFailure,
  closeVerificationResources,
  createPlainStaticServer,
  REFERENCE_MODEL_SCOPE_MARKER,
  runWebsiteStaticCli,
  runStaticSiteVerification,
  verifyReferenceModelRouteScope,
  WEBSITE_STATIC_CASES,
} from '../scripts/website/static-site.mjs'

const temporaryDirectories: string[] = []

async function createPublicDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'nuxt-content-mermaid-static-'))
  temporaryDirectories.push(directory)
  await mkdir(join(directory, 'getting-started'), { recursive: true })
  await writeFile(join(directory, 'index.html'), '<h1>Home route</h1>')
  await writeFile(join(directory, 'getting-started.html'), '<h1>Equivalent route</h1>')
  await writeFile(join(directory, 'getting-started/index.html'), '<h1>Getting started route</h1>')
  await writeFile(join(directory, '404.html'), '<h1>Provider fallback</h1>')
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => (
    rm(directory, { recursive: true, force: true })
  )))
})

describe('shared production static-site lifecycle', () => {
  it('keeps the serialized Reference model in the Reference initial route graph', async () => {
    const publicDirectory = await mkdtemp(join(tmpdir(), 'nuxt-content-mermaid-reference-scope-'))
    temporaryDirectories.push(publicDirectory)
    await mkdir(join(publicDirectory, '_nuxt'), { recursive: true })
    await mkdir(join(publicDirectory, 'reference'), { recursive: true })
    await writeFile(
      join(publicDirectory, 'reference/index.html'),
      `<main>${REFERENCE_MODEL_SCOPE_MARKER}</main><link rel="modulepreload" href="/_nuxt/reference-model.js">`,
    )
    await writeFile(
      join(publicDirectory, 'index.html'),
      '<main>Home</main><script type="module" src="/_nuxt/home.js"></script>',
    )
    await writeFile(join(publicDirectory, '_nuxt/reference-model.js'), `export default ${JSON.stringify(REFERENCE_MODEL_SCOPE_MARKER)}`)
    await writeFile(join(publicDirectory, '_nuxt/home.js'), 'export default "home"')

    await expect(verifyReferenceModelRouteScope({
      publicDirectory,
      routeManifest: [
        { logicalRoute: '/', physicalFiles: ['index.html'] },
        { logicalRoute: '/reference', physicalFiles: ['reference/index.html'] },
      ],
    })).resolves.toEqual({
      modelAssets: ['_nuxt/reference-model.js'],
      referenceRoute: '/reference',
      scoped: true,
    })
  })

  it('rejects a generated non-Reference initial graph that includes the serialized model', async () => {
    const publicDirectory = await mkdtemp(join(tmpdir(), 'nuxt-content-mermaid-reference-leak-'))
    temporaryDirectories.push(publicDirectory)
    await mkdir(join(publicDirectory, '_nuxt'), { recursive: true })
    await mkdir(join(publicDirectory, 'reference'), { recursive: true })
    await writeFile(
      join(publicDirectory, 'reference/index.html'),
      `<main>${REFERENCE_MODEL_SCOPE_MARKER}</main><script type="module" src="/_nuxt/reference-model.js"></script>`,
    )
    await writeFile(
      join(publicDirectory, 'index.html'),
      '<main>Home</main><link rel="modulepreload" href="/_nuxt/reference-model.js">',
    )
    await writeFile(join(publicDirectory, '_nuxt/reference-model.js'), `export default ${JSON.stringify(REFERENCE_MODEL_SCOPE_MARKER)}`)

    await expect(verifyReferenceModelRouteScope({
      publicDirectory,
      routeManifest: [
        { logicalRoute: '/', physicalFiles: ['index.html'] },
        { logicalRoute: '/reference', physicalFiles: ['reference/index.html'] },
      ],
    })).rejects.toThrow(/non-Reference.*serialized Reference model/i)
  })

  it('rejects a generated non-Reference payload that contains the serialized model', async () => {
    const publicDirectory = await mkdtemp(join(tmpdir(), 'nuxt-content-mermaid-reference-payload-leak-'))
    temporaryDirectories.push(publicDirectory)
    await mkdir(join(publicDirectory, '_nuxt'), { recursive: true })
    await mkdir(join(publicDirectory, 'reference'), { recursive: true })
    await writeFile(
      join(publicDirectory, 'reference/index.html'),
      `<main>${REFERENCE_MODEL_SCOPE_MARKER}</main><script type="module" src="/_nuxt/reference-model.js"></script>`,
    )
    await writeFile(join(publicDirectory, 'index.html'), '<main>Home</main>')
    await writeFile(join(publicDirectory, '_payload.json'), JSON.stringify(REFERENCE_MODEL_SCOPE_MARKER))
    await writeFile(join(publicDirectory, '_nuxt/reference-model.js'), `export default ${JSON.stringify(REFERENCE_MODEL_SCOPE_MARKER)}`)

    await expect(verifyReferenceModelRouteScope({
      publicDirectory,
      routeManifest: [
        { logicalRoute: '/', physicalFiles: ['index.html'] },
        { logicalRoute: '/reference', physicalFiles: ['reference/index.html'] },
      ],
    })).rejects.toThrow(/non-Reference.*payload.*serialized Reference model/i)
  })

  it('composes recovery and migration cases into the shared route inventory', () => {
    expect(WEBSITE_STATIC_CASES.map(routeCase => ({
      id: routeCase.id,
      logicalRoute: routeCase.logicalRoute,
    }))).toEqual([
      { id: 'home', logicalRoute: '/' },
      { id: 'getting-started', logicalRoute: '/getting-started' },
      { id: 'troubleshooting', logicalRoute: '/troubleshooting' },
      { id: 'migration-v3', logicalRoute: '/migration/v3' },
      { id: 'reference', logicalRoute: '/reference' },
    ])
  })

  it('groups equivalent physical outputs under their logical route', async () => {
    const publicDirectory = await createPublicDirectory()

    await expect(buildGeneratedRouteManifest({
      publicDirectory,
      allowedLogicalRoutes: ['/', '/getting-started'],
    })).resolves.toEqual([
      { logicalRoute: '/', physicalFiles: ['index.html'] },
      {
        logicalRoute: '/getting-started',
        physicalFiles: ['getting-started.html', 'getting-started/index.html'],
      },
    ])
  })

  it('serves only explicit direct routes and returns a real 404 without fallback', async () => {
    const publicDirectory = await createPublicDirectory()
    const server = await createPlainStaticServer({
      publicDirectory,
      directRoutes: {
        '/': 'index.html',
        '/getting-started/': 'getting-started/index.html',
      },
    })

    try {
      const direct = await fetch(`${server.origin}/getting-started/`, { redirect: 'manual' })
      const missing = await fetch(`${server.origin}/missing`, { redirect: 'manual' })

      expect(direct.status).toBe(200)
      expect(await direct.text()).toContain('Getting started route')
      expect(missing.status).toBe(404)
      expect(await missing.text()).not.toContain('Provider fallback')
      expect(server.requests()).toEqual([
        expect.objectContaining({
          url: '/getting-started/',
          status: 200,
          physicalFile: 'getting-started/index.html',
          fallback: false,
        }),
        expect.objectContaining({
          url: '/missing',
          status: 404,
          physicalFile: null,
          fallback: false,
        }),
      ])
    }
    finally {
      await server.close()
    }

    await expect(fetch(`${server.origin}/`)).rejects.toThrow()
  })

  it('only treats browser-policy script cancellation in a no-JavaScript context as expected', () => {
    expect(classifyRequestFailure({
      javaScriptEnabled: false,
      resourceType: 'script',
      failure: 'csp',
    })).toBe('expected-script-cancellation')
    expect(classifyRequestFailure({
      javaScriptEnabled: true,
      resourceType: 'script',
      failure: 'csp',
    })).toBe('blocking')
    expect(classifyRequestFailure({
      javaScriptEnabled: false,
      resourceType: 'script',
      failure: 'net::ERR_FAILED',
    })).toBe('blocking')
    expect(classifyRequestFailure({
      javaScriptEnabled: false,
      resourceType: 'stylesheet',
      failure: 'net::ERR_FAILED',
    })).toBe('blocking')
  })

  it('attempts every owned cleanup even when browser cleanup fails', async () => {
    const browserClose = vi.fn(async () => {
      throw new Error('browser cleanup failed')
    })
    const serverClose = vi.fn(async () => {})

    await expect(closeVerificationResources({
      browser: { close: browserClose },
      server: { close: serverClose },
    })).rejects.toThrow('browser cleanup failed')

    expect(browserClose).toHaveBeenCalledOnce()
    expect(serverClose).toHaveBeenCalledOnce()
  })

  it('closes the static server when browser launch fails', async () => {
    const publicDirectory = await createPublicDirectory()
    const serverClose = vi.fn(async () => {})

    await expect(runStaticSiteVerification({
      publicDirectory,
      allowedLogicalRoutes: ['/', '/getting-started'],
      cases: [{
        id: 'home',
        logicalRoute: '/',
        directUrl: '/',
        physicalFile: 'index.html',
      }],
      startServer: vi.fn(async () => ({
        origin: 'http://127.0.0.1:1',
        requests: () => [],
        close: serverClose,
      })),
      launchBrowser: vi.fn(async () => {
        throw new Error('browser launch failed')
      }),
    })).rejects.toThrow('browser launch failed')

    expect(serverClose).toHaveBeenCalledOnce()
  })

  it('observes prerendered, hydrated, request-boundary, and no-JavaScript evidence through one lifecycle', async () => {
    const publicDirectory = await createPublicDirectory()
    const source = 'graph TD\n  Source --> SVG'
    await writeFile(join(publicDirectory, 'index.html'), `<!doctype html>
<html><head><title>Home</title><meta name="description" content="Home description"></head>
<body><nav aria-label="Primary navigation"><a href="/getting-started">Get started</a></nav>
<main data-page-id="home" data-hydration-state="prerendered">
<h1>Home route</h1><div data-contract-demo="primary"><div data-contract-diagram><svg data-toolbar-icon></svg><div class="mermaid"><pre>${source}</pre></div></div>
<pre data-contract-source>${source}</pre><p data-artifact-version="3.0.0">3.0.0</p></div>
<div data-contract-demo="lazy"><div class="mermaid"><pre>${source}</pre></div><pre data-contract-source>${source}</pre></div></main>
<script>document.querySelector('main').dataset.hydrationState='hydrated';document.querySelector('[data-contract-demo="primary"] [data-contract-diagram] .mermaid').innerHTML='<svg aria-label="diagram"></svg>'</script>
</body></html>`)
    await writeFile(join(publicDirectory, 'getting-started/index.html'), `<!doctype html>
<html><head><title>Getting started</title><meta name="description" content="Ordinary route description"></head>
<body><nav aria-label="Primary navigation"><a href="/">Home</a></nav>
<main data-page-id="getting-started" data-hydration-state="prerendered"><h1>Getting started route</h1></main>
<script>document.querySelector('main').dataset.hydrationState='hydrated'</script>
</body></html>`)

    await expect(runStaticSiteVerification({
      publicDirectory,
      cases: [
        {
          id: 'home',
          logicalRoute: '/',
          directUrl: '/',
          physicalFile: 'index.html',
          title: 'Home',
          description: 'Home description',
          heading: 'Home route',
          navigationHref: '/getting-started',
          contractSource: source,
          artifactVersion: '3.0.0',
        },
        {
          id: 'getting-started',
          logicalRoute: '/getting-started',
          directUrl: '/getting-started/',
          physicalFile: 'getting-started/index.html',
          title: 'Getting started',
          description: 'Ordinary route description',
          heading: 'Getting started route',
          navigationHref: '/',
        },
      ],
    })).resolves.toMatchObject({
      phase: 'static-site',
      routes: [
        {
          id: 'home',
          prerendered: true,
          hydrated: true,
          noJavaScript: true,
          svgCount: 1,
          artifactVersion: '3.0.0',
        },
        {
          id: 'getting-started',
          prerendered: true,
          hydrated: true,
          noJavaScript: true,
        },
      ],
      errors: [],
    })
  })

  it('runs route-owned observations inside the shared browser lifecycle', async () => {
    const publicDirectory = await createPublicDirectory()
    await writeFile(join(publicDirectory, 'index.html'), `<!doctype html>
<html><head><title>Home</title><meta name="description" content="Home description"></head>
<body><nav aria-label="Primary navigation"><a href="/getting-started">Get started</a></nav>
<main data-page-id="home" data-hydration-state="prerendered"><h1>Home route</h1><p data-journey>First Successful Render</p></main>
<script>document.querySelector('main').dataset.hydrationState='hydrated'</script>
</body></html>`)

    const observeNoJavaScript = vi.fn(async ({ page }) => ({
      journey: await page.locator('[data-journey]').textContent(),
    }))
    const observeHydrated = vi.fn(async ({ page }) => ({
      journey: await page.locator('[data-journey]').textContent(),
    }))

    await expect(runStaticSiteVerification({
      publicDirectory,
      allowedLogicalRoutes: ['/', '/getting-started'],
      cases: [{
        id: 'home',
        logicalRoute: '/',
        directUrl: '/',
        physicalFile: 'index.html',
        title: 'Home',
        description: 'Home description',
        heading: 'Home route',
        navigationHref: '/getting-started',
        observeNoJavaScript,
        observeHydrated,
      }],
    })).resolves.toMatchObject({
      routes: [{
        id: 'home',
        observations: {
          noJavaScript: { journey: 'First Successful Render' },
          hydrated: { journey: 'First Successful Render' },
        },
      }],
    })

    expect(observeNoJavaScript).toHaveBeenCalledOnce()
    expect(observeHydrated).toHaveBeenCalledOnce()
  })

  it('runs a focused case through the shared static lifecycle only', async () => {
    const verifier = vi.fn(async ({ cases }) => ({
      phase: 'static-site',
      routes: cases.map((routeCase: (typeof WEBSITE_STATIC_CASES)[number]) => ({
        id: routeCase.id,
        logicalRoute: routeCase.logicalRoute,
        directUrl: routeCase.directUrl,
        physicalFile: routeCase.physicalFile,
        prerendered: true,
        hydrated: true,
        noJavaScript: true,
      })),
      manifest: [],
      requestBoundary: {
        requestCount: 0,
        uniqueStaticFiles: 0,
        directRouteRequests: [],
        responseCount: 0,
        redirects: 0,
        fallbacks: 0,
        externalRequests: 0,
        failedRequests: 0,
      },
      noJavaScript: {
        expectedScriptCancellations: 0,
        reasons: [],
      },
      errors: [],
    }))
    await expect(runWebsiteStaticCli({
      argv: ['--case', 'reference'],
      cases: WEBSITE_STATIC_CASES,
      verifier,
    })).resolves.toMatchObject({
      phase: 'static-site',
      routes: [{ id: 'reference' }],
    })
    expect(verifier).toHaveBeenCalledWith(expect.objectContaining({
      allowedLogicalRoutes: ['/', '/getting-started', '/troubleshooting', '/migration/v3', '/reference'],
      cases: [expect.objectContaining({ id: 'reference' })],
    }))
  })
})
