import { describe, expect, it, vi } from 'vitest'
import type { ReferenceMismatch } from '../scripts/website/reference-parity.mjs'
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
      {
        id: 'reference',
        logicalRoute: '/reference',
        directUrl: '/reference/',
        physicalFile: 'reference/index.html',
        prerendered: true,
        hydrated: true,
        noJavaScript: true,
        observations: {
          noJavaScript: {
            identity: `@barzhsieh/nuxt-content-mermaid@${version}`,
            recordCount: 43,
            uniqueFragments: 43,
            initialHtmlComplete: true,
          },
          hydrated: {
            ...hydratedAccessibility,
            identity: `@barzhsieh/nuxt-content-mermaid@${version}`,
            recordCount: 43,
            uniqueFragments: 43,
            sameReferencePage: true,
          },
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

function referenceEvidence(version = '3.0.0', recordCount = 43, mismatches: readonly ReferenceMismatch[] = []) {
  return {
    artifact: artifactEvidence(version),
    recordCount,
    mismatches,
  }
}

function referenceObservations(site: ReturnType<typeof staticEvidence>) {
  const route = site.routes.find(route => route.id === 'reference')
  if (!route) throw new Error('Reference fixture is missing')
  const { noJavaScript, hydrated } = route.observations
  if (!('recordCount' in noJavaScript) || !('identity' in hydrated)) throw new Error('Reference fixture observations are missing')
  return { noJavaScript, hydrated }
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
    const verifyReference = vi.fn(async ({ resolveArtifact }) => {
      order.push('reference')
      return referenceEvidence((await resolveArtifact()).version)
    })
    const verifyStatic = vi.fn(async () => {
      order.push('static')
      return staticEvidence()
    })

    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand,
      verifyArtifact,
      verifyReference,
      verifyStatic,
    })).resolves.toMatchObject({
      mode: 'website-verification',
      correlation: {
        artifactVersion: '3.0.0',
        homepageDisclosure: '3.0.0',
        hydratedSvgCount: 1,
        referenceRecordCount: 43,
      },
    })
    expect(order).toEqual(['typecheck', 'generate', 'artifact', 'reference', 'static'])
    expect(runCommand).toHaveBeenCalledTimes(2)
    expect(verifyArtifact).toHaveBeenCalledOnce()
    expect(verifyReference).toHaveBeenCalledOnce()
    expect(verifyStatic).toHaveBeenCalledOnce()
  })

  it.each([
    [artifactEvidence('3.0.0'), staticEvidence('3.0.1'), 'disclosure'],
    [artifactEvidence('3.0.0'), staticEvidence('3.0.0', 0), 'SVG'],
  ])('blocks inconsistent composed evidence %#', async (artifact, site, message) => {
    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand: vi.fn(async () => undefined),
      verifyArtifact: vi.fn(async () => artifact),
      verifyReference: vi.fn(async () => referenceEvidence()),
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
      verifyReference: vi.fn(async () => referenceEvidence()),
      verifyStatic: vi.fn(async () => site),
    })).rejects.toThrow(message)
  })

  it('requires axe evidence from hydrated routes without claiming JavaScript-disabled coverage', async () => {
    const site = staticEvidence()

    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand: vi.fn(async () => undefined),
      verifyArtifact: vi.fn(async () => artifactEvidence()),
      verifyReference: vi.fn(async () => referenceEvidence()),
      verifyStatic: vi.fn(async () => site),
    })).resolves.toMatchObject({ mode: 'website-verification' })
  })

  it.each([
    [referenceEvidence('3.0.1'), 'artifact version'],
    [referenceEvidence('3.0.0', 42), 'record count'],
    [referenceEvidence('3.0.0', 43, [{ category: 'default-mismatch' }]), 'mismatches'],
  ])('blocks incomplete or inconsistent Reference parity evidence %#', async (reference, message) => {
    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand: vi.fn(async () => undefined),
      verifyArtifact: vi.fn(async () => artifactEvidence()),
      verifyReference: vi.fn(async () => reference),
      verifyStatic: vi.fn(async () => staticEvidence()),
    })).rejects.toThrow(message)
  })

  it.each([
    ['no-JavaScript count', (site: ReturnType<typeof staticEvidence>) => {
      referenceObservations(site).noJavaScript.recordCount = 42
    }],
    ['hydrated identity', (site: ReturnType<typeof staticEvidence>) => {
      referenceObservations(site).hydrated.identity = '@barzhsieh/nuxt-content-mermaid@3.0.1'
    }],
    ['unique fragments', (site: ReturnType<typeof staticEvidence>) => {
      referenceObservations(site).hydrated.uniqueFragments = 42
    }],
    ['route evidence', (site: ReturnType<typeof staticEvidence>) => {
      site.routes.pop()
    }],
  ])('blocks missing or mismatched Reference %s', async (_label, mutate) => {
    const site = staticEvidence()
    mutate(site)
    await expect(verifyWebsite({
      repositoryRoot: '/repo',
      runCommand: vi.fn(async () => undefined),
      verifyArtifact: vi.fn(async () => artifactEvidence()),
      verifyReference: vi.fn(async () => referenceEvidence()),
      verifyStatic: vi.fn(async () => site),
    })).rejects.toThrow('Reference route evidence')
  })
})
