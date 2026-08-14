import { describe, expect, it } from 'vitest'
import {
  validateWebsiteArtifactIdentity,
  verifyWebsiteArtifactIdentity,
  WebsiteArtifactIntegrationFailure,
} from '../scripts/website/artifact.mjs'

const packageName = '@barzhsieh/nuxt-content-mermaid'
const version = '3.0.0'
const integrity = 'sha512-dGVzdA=='
const tarball = 'https://registry.npmjs.org/@barzhsieh/nuxt-content-mermaid/-/nuxt-content-mermaid-3.0.0.tgz'

function exactIdentity(overrides: Record<string, unknown> = {}) {
  const packageRoot = '/repo/node_modules/.pnpm/@barzhsieh+nuxt-content-mermaid@3.0.0/node_modules/@barzhsieh/nuxt-content-mermaid'
  return {
    repositoryRoot: '/repo',
    packageName,
    expectedVersion: version,
    websiteSpecifier: version,
    workspace: {
      linkWorkspacePackages: false,
      preferWorkspacePackages: false,
    },
    lockfile: { specifier: version, version, integrity },
    registry: {
      name: packageName,
      version,
      dist: { integrity, tarball },
    },
    installed: {
      manifestName: packageName,
      manifestVersion: version,
      packageMetadata: {
        name: packageName,
        version,
        exports: undefined,
        types: undefined,
        typesVersions: undefined,
      },
      manifestPath: `${packageRoot}/package.json`,
      moduleEntryPath: `${packageRoot}/dist/module.mjs`,
    },
    nuxtModules: [packageName, '@nuxt/content'],
    disclosure: version,
    ...overrides,
  }
}

describe('website artifact integration identity', () => {
  it('accepts one registry installation resolved from the website boundary', () => {
    expect(validateWebsiteArtifactIdentity(exactIdentity())).toMatchObject({
      phase: 'artifact-integration',
      packageName,
      version,
      integrity,
      tarball,
      artifactRoot: '/repo/node_modules/.pnpm/@barzhsieh+nuxt-content-mermaid@3.0.0/node_modules/@barzhsieh/nuxt-content-mermaid',
      packageMetadata: {
        name: packageName,
        version,
      },
    })
  })

  it.each([
    ['website specifier', { websiteSpecifier: '^3.0.0' }],
    ['lockfile integrity', { lockfile: { specifier: version, version, integrity: 'sha512-b3RoZXI=' } }],
    ['installed manifest', { installed: {
      manifestName: packageName,
      manifestVersion: '3.0.1',
      manifestPath: '/repo/node_modules/.pnpm/package/package.json',
      moduleEntryPath: '/repo/node_modules/.pnpm/package/dist/module.mjs',
    } }],
    ['homepage disclosure', { disclosure: '3.0.1' }],
  ])('classifies a %s mismatch as a website artifact-integration failure', (_label, override) => {
    expect(() => validateWebsiteArtifactIdentity(exactIdentity(override)))
      .toThrow(WebsiteArtifactIntegrationFailure)
  })

  it('rejects repository-root self-reference resolution', () => {
    expect(() => validateWebsiteArtifactIdentity(exactIdentity({
      installed: {
        manifestName: packageName,
        manifestVersion: version,
        manifestPath: '/repo/package.json',
        moduleEntryPath: '/repo/dist/module.mjs',
      },
    }))).toThrow(/registry \.pnpm installation/)
  })

  it('resolves installation identity from the website manifest context', async () => {
    const resolver = async (websiteManifestPath: string, requestedPackage: string) => {
      expect(websiteManifestPath).toBe('/repo/website/package.json')
      expect(requestedPackage).toBe(packageName)
      return exactIdentity().installed
    }

    await expect(verifyWebsiteArtifactIdentity({
      repositoryRoot: '/repo',
      readText: async (path: string) => ({
        '/repo/pnpm-workspace.yaml': 'linkWorkspacePackages: false\npreferWorkspacePackages: false\n',
        '/repo/website/package.json': JSON.stringify({ dependencies: { [packageName]: version } }),
        '/repo/pnpm-lock.yaml': `lockfileVersion: '9.0'\nimporters:\n  website:\n    dependencies:\n      '${packageName}':\n        specifier: ${version}\n        version: ${version}\npackages:\n  '${packageName}@${version}':\n    resolution:\n      integrity: ${integrity}\n`,
        '/repo/website/.output/public/index.html': `<p data-artifact-version="${version}">${version}</p>`,
      } as Record<string, string>)[path] ?? '',
      resolveInstalledPackage: resolver,
      loadNuxtModules: async () => [packageName, '@nuxt/content'],
      fetchRegistryMetadata: async () => exactIdentity().registry,
    })).resolves.toMatchObject({
      phase: 'artifact-integration',
      version,
      moduleEntryPath: expect.stringContaining('/node_modules/.pnpm/'),
    })
  })
})
