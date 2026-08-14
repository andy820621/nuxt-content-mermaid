import { describe, expect, it, vi } from 'vitest'
import { verifyWebsite } from '../scripts/website/verify.mjs'

function artifactEvidence(version = '3.0.0') {
  return {
    phase: 'artifact-integration',
    packageName: '@barzhsieh/nuxt-content-mermaid',
    version,
    integrity: 'sha512-dGVzdA==',
    tarball: 'https://registry.npmjs.org/package.tgz',
    artifactRoot: '/repo/node_modules/.pnpm/package',
    packageMetadata: {
      name: '@barzhsieh/nuxt-content-mermaid',
      version,
    },
    manifestPath: '/repo/node_modules/.pnpm/package/package.json',
    moduleEntryPath: '/repo/node_modules/.pnpm/package/dist/module.mjs',
  }
}

function staticEvidence(version = '3.0.0', svgCount = 1, criticalAccessibilityViolations: number | null = 0) {
  const hydratedAccessibility = criticalAccessibilityViolations === null
    ? {}
    : { criticalAccessibilityViolations }
  return {
    phase: 'static-site',
    manifest: [],
    routes: [
      {
        id: 'home',
        logicalRoute: '/',
        directUrl: '/',
        physicalFile: 'index.html',
        prerendered: true,
        hydrated: true,
        noJavaScript: true,
        artifactVersion: version,
        svgCount,
        observations: {
          noJavaScript: {},
          hydrated: hydratedAccessibility,
        },
      },
      {
        id: 'getting-started',
        logicalRoute: '/getting-started',
        directUrl: '/getting-started/',
        physicalFile: 'getting-started/index.html',
        prerendered: true,
        hydrated: true,
        noJavaScript: true,
        observations: {
          noJavaScript: {},
          hydrated: hydratedAccessibility,
        },
      },
    ],
    requestBoundary: {
      requestCount: 2,
      uniqueStaticFiles: 2,
      directRouteRequests: [],
      responseCount: 2,
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
  }
}

describe('composed website verification', () => {
  it('runs build phases before correlating artifact and static evidence', async () => {
    const order: string[] = []
    const runCommand = vi.fn(async ({ args }) => {
      order.push(args.at(-1))
    })
    const verifyArtifact = vi.fn(async () => {
      order.push('artifact')
      return artifactEvidence()
    })
    const verifyStatic = vi.fn(async () => {
      order.push('static')
      return staticEvidence()
    })

    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand,
      verifyArtifact,
      verifyStatic,
    })).resolves.toMatchObject({
      mode: 'website-verification',
      correlation: {
        artifactVersion: '3.0.0',
        homepageDisclosure: '3.0.0',
        hydratedSvgCount: 1,
      },
    })
    expect(order).toEqual(['typecheck', 'generate', 'artifact', 'static'])
  })

  it.each([
    [artifactEvidence('3.0.0'), staticEvidence('3.0.1'), 'disclosure'],
    [artifactEvidence('3.0.0'), staticEvidence('3.0.0', 0), 'SVG'],
  ])('blocks inconsistent composed evidence %#', async (artifact, site, message) => {
    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand: vi.fn(async () => undefined),
      verifyArtifact: vi.fn(async () => artifact),
      verifyStatic: vi.fn(async () => site),
    })).rejects.toThrow(message)
  })

  it.each([
    [staticEvidence('3.0.0', 1, 1), 'critical accessibility'],
    [staticEvidence('3.0.0', 1, null), 'critical accessibility'],
  ])('blocks incomplete or failing accessibility evidence %#', async (site, message) => {
    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand: vi.fn(async () => undefined),
      verifyArtifact: vi.fn(async () => artifactEvidence()),
      verifyStatic: vi.fn(async () => site),
    })).rejects.toThrow(message)
  })

  it('requires axe evidence from hydrated routes without claiming JavaScript-disabled coverage', async () => {
    const site = staticEvidence()

    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand: vi.fn(async () => undefined),
      verifyArtifact: vi.fn(async () => artifactEvidence()),
      verifyStatic: vi.fn(async () => site),
    })).resolves.toMatchObject({ mode: 'website-verification' })
  })
})
