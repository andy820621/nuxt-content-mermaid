import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createReleaseVerificationOperations,
  formatArtifactChecksum,
  runCommand,
} from '../scripts/release-verification/operations.mjs'
import {
  classifyInfrastructureCause,
  ReleaseVerificationInfrastructureError,
} from '../scripts/release-verification/failure-classification.mjs'
import type { PackageArtifact, VersionProfile } from '../scripts/release-verification/runner.mjs'

const temporaryDirectories: string[] = []
const execFileAsync = promisify(execFile)

const profile = {
  id: 'profile-without-resolution-evidence',
  nodeVersion: process.versions.node,
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.5.2',
    nuxtContent: '3.15.2',
    mermaid: '11.16.1',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

const finalProfile = {
  id: 'v3-known-latest',
  nodeVersion: process.versions.node,
  versions: {
    ...profile.versions,
    mermaid: '11.16.1',
  },
  expectedResolutions: {
    nuxtKit: '4.5.2',
    nuxtSchema: '4.5.2',
  },
}

function createArtifactFixture(overrides: Partial<PackageArtifact> = {}): PackageArtifact {
  return {
    archivePath: '/tmp/package.tgz',
    filename: 'package.tgz',
    sha256: 'abc123',
    integritySha512: 'sha512-Zml4dHVyZQ==',
    packlist: ['dist/module.mjs', 'dist/types.d.mts', 'package.json'],
    packageName: '@barzhsieh/nuxt-content-mermaid',
    packageVersion: '2.2.3',
    ...overrides,
  }
}

async function createTemporaryDirectory(label: string) {
  const directory = await mkdtemp(join(tmpdir(), `${label}-`))
  temporaryDirectories.push(directory)
  return directory
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function createTemplate(nuxtConfig = `
export default defineNuxtConfig({
  modules: ['@nuxt/content', '@barzhsieh/nuxt-content-mermaid'],
})
`) {
  const templateDirectory = await createTemporaryDirectory('consumer-template')
  await writeJson(join(templateDirectory, 'package.template.json'), {
    name: 'package-artifact-consumer',
    private: true,
    type: 'module',
  })
  await writeFile(join(templateDirectory, 'nuxt.config.ts'), nuxtConfig)
  return templateDirectory
}

async function createInstalledPackage(consumerDirectory: string, name: string, version: string) {
  const packageDirectory = join(consumerDirectory, 'node_modules', ...name.split('/'))
  await mkdir(packageDirectory, { recursive: true })
  await writeJson(join(packageDirectory, 'package.json'), { name, version })
}

async function populateInstalledPackages(
  consumerDirectory: string,
  packageVersion = '2.2.3',
  selectedProfile: VersionProfile = profile,
) {
  await createInstalledPackage(consumerDirectory, '@barzhsieh/nuxt-content-mermaid', packageVersion)
  await createInstalledPackage(
    consumerDirectory,
    'better-sqlite3',
    selectedProfile.versions.betterSqlite3,
  )
  await createInstalledPackage(consumerDirectory, 'nuxt', selectedProfile.versions.nuxt)
  await createInstalledPackage(
    consumerDirectory,
    '@nuxt/content',
    selectedProfile.versions.nuxtContent,
  )
  await createInstalledPackage(consumerDirectory, 'mermaid', selectedProfile.versions.mermaid)
  await createInstalledPackage(consumerDirectory, 'typescript', selectedProfile.versions.typescript)
  await createInstalledPackage(consumerDirectory, 'vue-tsc', selectedProfile.versions.vueTsc)
  if (selectedProfile.expectedResolutions) {
    await createInstalledPackage(
      consumerDirectory,
      '@nuxt/kit',
      selectedProfile.expectedResolutions.nuxtKit,
    )
    await createInstalledPackage(
      consumerDirectory,
      '@nuxt/schema',
      selectedProfile.expectedResolutions.nuxtSchema,
    )
  }
}

async function createNestedInstalledPackage(
  consumerDirectory: string,
  issuerPackageName: string,
  dependencyPackageName: string,
  version: string,
) {
  const dependencyDirectory = join(
    consumerDirectory,
    'node_modules',
    ...issuerPackageName.split('/'),
    'node_modules',
    ...dependencyPackageName.split('/'),
  )
  await mkdir(dependencyDirectory, { recursive: true })
  await writeJson(join(dependencyDirectory, 'package.json'), {
    name: dependencyPackageName,
    version,
  })
}

async function createPackageArchive(manifest: Record<string, unknown>, files: string[]) {
  const sourceDirectory = await createTemporaryDirectory('package-archive-source')
  const packageDirectory = join(sourceDirectory, 'package')
  const artifactDirectory = await createTemporaryDirectory('package-archive')
  const archivePath = join(artifactDirectory, 'package.tgz')
  await mkdir(packageDirectory, { recursive: true })
  await writeJson(join(packageDirectory, 'package.json'), manifest)
  for (const file of files) {
    const path = join(packageDirectory, file)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, 'export default {}\n')
  }
  await execFileAsync('tar', ['-czf', archivePath, '-C', sourceDirectory, 'package'])
  return archivePath
}

async function writeArtifactChecksum(archivePath: string, integrityOverride?: string) {
  const archiveBytes = await readFile(archivePath)
  const integrity = integrityOverride
    ?? `sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`
  const checksumPath = join(dirname(archivePath), 'artifact.sha512')
  await writeFile(checksumPath, `${integrity}  ${basename(archivePath)}\n`)
  return checksumPath
}

function createContractManifest(overrides: Record<string, unknown> = {}) {
  return {
    name: '@barzhsieh/nuxt-content-mermaid',
    version: '2.2.3',
    engines: {
      node: '>=22.19.0',
    },
    peerDependencies: {
      '@nuxt/content': '>=3.5.0 <4.0.0',
      'nuxt': '^4.1.0',
    },
    dependencies: {
      '@nuxt/kit': '^4.5.2',
      'mermaid': '~11.16.1',
    },
    exports: {
      '.': './dist/module.mjs',
    },
    ...overrides,
  }
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, {
    recursive: true,
    force: true,
  })))
})

describe('clean consumer installation', () => {
  it('keeps pnpm lifecycle-only config out of the consumer npm install', async () => {
    const templateDirectory = await createTemplate()
    const consumerDirectory = await createTemporaryDirectory('lifecycle-isolated-consumer')
    vi.stubEnv('npm_config_allow_scripts', 'esbuild')
    vi.stubEnv('npm_config_globalconfig', '/pnpm/lifecycle/npmrc')
    vi.stubEnv('NPM_CONFIG_REGISTRY', 'https://registry.example.test/')
    const commandRunner = vi.fn(async (invocation) => {
      await runCommand({
        command: process.execPath,
        args: [
          '-e',
          `
if (process.env.npm_config_allow_scripts || process.env.npm_config_globalconfig) {
  console.error('pnpm lifecycle-only config reached the consumer install')
  process.exit(1)
}
if (process.env.NPM_CONFIG_REGISTRY !== 'https://registry.example.test/') {
  console.error('unrelated npm registry config was removed')
  process.exit(1)
}
`,
        ],
        cwd: invocation.cwd,
        env: invocation.env,
      })
      await populateInstalledPackages(consumerDirectory, '3.0.0')
      return {}
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    await expect(operations.installConsumer({
      packageSource: {
        kind: 'registry',
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
      },
      consumerDirectory,
      profile,
    })).resolves.toMatchObject({ packageVersion: '3.0.0' })
  })

  it('installs only the exact registry version and reports the resolved identity', async () => {
    const templateDirectory = await createTemplate()
    const consumerDirectory = await createTemporaryDirectory('registry-consumer')
    const commandRunner = vi.fn(async () => {
      await populateInstalledPackages(consumerDirectory, '3.0.0')
      return {}
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    const result = await operations.installConsumer({
      packageSource: {
        kind: 'registry',
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
      },
      consumerDirectory,
      profile,
    })

    const manifest = JSON.parse(await readFile(join(consumerDirectory, 'package.json'), 'utf8'))
    expect(manifest.dependencies['@barzhsieh/nuxt-content-mermaid']).toBe('3.0.0')
    expect(JSON.stringify(manifest)).not.toContain('workspace:')
    expect(JSON.stringify(manifest)).not.toContain('file:')
    expect(result).toEqual({
      packageVersion: '3.0.0',
      profileVersions: profile.versions,
    })
    expect(commandRunner).toHaveBeenCalledWith({
      command: 'npm',
      args: ['install', '--no-audit', '--no-fund', '--package-lock=true'],
      cwd: consumerDirectory,
      env: {
        npm_config_allow_scripts: undefined,
        npm_config_globalconfig: undefined,
      },
    })
  })

  it.each([
    'latest',
    '^3.0.0',
    'workspace:*',
    'file:../package.tgz',
    '/tmp/package.tgz',
  ])('rejects the registry fallback %s before installation', async (packageVersion) => {
    const templateDirectory = await createTemplate()
    const consumerDirectory = await createTemporaryDirectory('registry-consumer')
    const commandRunner = vi.fn()
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    await expect(operations.installConsumer({
      packageSource: {
        kind: 'registry',
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion,
      },
      consumerDirectory,
      profile,
    })).rejects.toThrow('Registry smoke requires an exact package version')
    expect(commandRunner).not.toHaveBeenCalled()
  })

  it('rejects a registry package resolved to another version', async () => {
    const templateDirectory = await createTemplate()
    const consumerDirectory = await createTemporaryDirectory('registry-consumer')
    const commandRunner = vi.fn(async () => {
      await populateInstalledPackages(consumerDirectory, '3.0.1')
      return {}
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    await expect(operations.installConsumer({
      packageSource: {
        kind: 'registry',
        packageName: '@barzhsieh/nuxt-content-mermaid',
        packageVersion: '3.0.0',
      },
      consumerDirectory,
      profile,
    })).rejects.toThrow('expected 3.0.0, received 3.0.1')
  })

  it('installs the tarball with exact profile versions and reports resolved versions', async () => {
    const templateDirectory = await createTemplate()
    const consumerDirectory = await createTemporaryDirectory('clean-consumer')
    const archivePath = join(await createTemporaryDirectory('artifact'), 'package.tgz')
    await writeFile(archivePath, '')
    const commandRunner = vi.fn(async () => {
      await populateInstalledPackages(consumerDirectory)
      return {}
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    const resolved = await operations.installConsumer({
      packageSource: {
        kind: 'artifact',
        artifact: createArtifactFixture({ archivePath }),
      },
      consumerDirectory,
      profile,
    })

    const packageJson = JSON.parse(await readFile(join(consumerDirectory, 'package.json'), 'utf8'))
    expect(packageJson.dependencies).toEqual({
      '@barzhsieh/nuxt-content-mermaid': pathToFileURL(archivePath).href,
      '@nuxt/content': '3.15.2',
      'better-sqlite3': '12.11.1',
      'mermaid': '11.16.1',
      'nuxt': '4.5.2',
    })
    expect(packageJson.devDependencies).toEqual({
      'typescript': '5.9.3',
      'vue-tsc': '3.2.5',
    })
    expect(resolved).toEqual({
      packageVersion: '2.2.3',
      profileVersions: profile.versions,
    })
    expect(commandRunner).toHaveBeenCalledOnce()
  })

  it('pins shallow toolchain resolutions and reports dependency-context versions', async () => {
    const templateDirectory = await createTemplate()
    const consumerDirectory = await createTemporaryDirectory('final-profile-consumer')
    const archivePath = join(await createTemporaryDirectory('artifact'), 'package.tgz')
    await writeFile(archivePath, '')
    const commandRunner = vi.fn(async () => {
      await populateInstalledPackages(consumerDirectory, '2.2.3', finalProfile)
      return {}
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    const resolved = await operations.installConsumer({
      packageSource: {
        kind: 'artifact',
        artifact: createArtifactFixture({ archivePath }),
      },
      consumerDirectory,
      profile: finalProfile,
    })

    const packageJson = JSON.parse(await readFile(join(consumerDirectory, 'package.json'), 'utf8'))
    expect(packageJson.dependencies.mermaid).toBe('11.16.1')
    expect(packageJson.devDependencies['@nuxt/schema']).toBe('4.5.2')
    expect(packageJson.overrides).toEqual({
      '@nuxt/kit': '4.5.2',
      '@nuxt/schema': '4.5.2',
    })
    expect(resolved).toEqual({
      packageVersion: '2.2.3',
      profileVersions: finalProfile.versions,
      expectedResolutions: finalProfile.expectedResolutions,
    })
  })

  it.each([
    ['@barzhsieh/nuxt-content-mermaid', 'mermaid', '11.12.3', 'expected 11.16.1, received 11.12.3'],
    ['@barzhsieh/nuxt-content-mermaid', '@nuxt/kit', '4.3.1', 'expected 4.5.2, received 4.3.1'],
    ['nuxt', '@nuxt/schema', '4.3.1', 'expected 4.5.2, received 4.3.1'],
  ])(
    'rejects %s dependency-context resolution of %s even when the consumer root matches',
    async (issuerPackageName, dependencyPackageName, nestedVersion, expectedMessage) => {
      const templateDirectory = await createTemplate()
      const consumerDirectory = await createTemporaryDirectory('dependency-context-consumer')
      const commandRunner = vi.fn(async () => {
        await populateInstalledPackages(consumerDirectory, '2.2.3', finalProfile)
        await createNestedInstalledPackage(
          consumerDirectory,
          issuerPackageName,
          dependencyPackageName,
          nestedVersion,
        )
        return {}
      })
      const operations = createReleaseVerificationOperations({
        templateDirectory,
        commandRunner,
      })

      await expect(operations.installConsumer({
        packageSource: { kind: 'artifact', artifact: createArtifactFixture() },
        consumerDirectory,
        profile: finalProfile,
      })).rejects.toThrow(expectedMessage)
    },
  )

  it('rejects a repository-relative module before installation', async () => {
    const templateDirectory = await createTemplate(`
import contentMermaid from '../../../src/module'
export default defineNuxtConfig({ modules: [contentMermaid] })
`)
    const consumerDirectory = await createTemporaryDirectory('clean-consumer')
    const commandRunner = vi.fn()
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    await expect(operations.installConsumer({
      packageSource: { kind: 'artifact', artifact: createArtifactFixture() },
      consumerDirectory,
      profile,
    })).rejects.toThrow('repository-relative module path')
    expect(commandRunner).not.toHaveBeenCalled()
  })

  it('rejects a configured Mermaid renderer before installation', async () => {
    const templateDirectory = await createTemplate(`
export default defineNuxtConfig({
  modules: ['@nuxt/content', '@barzhsieh/nuxt-content-mermaid'],
  contentMermaid: {
    components: {
      renderer: 'FakeMermaidRenderer',
    },
  },
})
`)
    const consumerDirectory = await createTemporaryDirectory('clean-consumer')
    const commandRunner = vi.fn()
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    await expect(operations.installConsumer({
      packageSource: { kind: 'artifact', artifact: createArtifactFixture() },
      consumerDirectory,
      profile,
    })).rejects.toThrow('Mermaid substitution')
    expect(commandRunner).not.toHaveBeenCalled()
  })

  it('rejects a template-local SVG component before installation', async () => {
    const templateDirectory = await createTemplate()
    const componentsDirectory = join(templateDirectory, 'components')
    await mkdir(componentsDirectory)
    await writeFile(
      join(componentsDirectory, 'Mermaid.vue'),
      '<template><svg><text>fake diagram</text></svg></template>\n',
    )
    const consumerDirectory = await createTemporaryDirectory('clean-consumer')
    const commandRunner = vi.fn()
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    await expect(operations.installConsumer({
      packageSource: { kind: 'artifact', artifact: createArtifactFixture() },
      consumerDirectory,
      profile,
    })).rejects.toThrow('Mermaid substitution')
    expect(commandRunner).not.toHaveBeenCalled()
  })

  it('rejects an installed package linked outside the clean consumer', async () => {
    const templateDirectory = await createTemplate()
    const consumerDirectory = await createTemporaryDirectory('clean-consumer')
    const linkedPackage = await createTemporaryDirectory('workspace-package')
    await writeJson(join(linkedPackage, 'package.json'), {
      name: '@barzhsieh/nuxt-content-mermaid',
      version: '2.2.3',
    })
    const commandRunner = vi.fn(async () => {
      await populateInstalledPackages(consumerDirectory)
      const installedPackage = join(
        consumerDirectory,
        'node_modules',
        '@barzhsieh',
        'nuxt-content-mermaid',
      )
      await rm(installedPackage, { recursive: true, force: true })
      await symlink(linkedPackage, installedPackage, 'dir')
      return {}
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory,
      commandRunner,
    })

    await expect(operations.installConsumer({
      packageSource: { kind: 'artifact', artifact: createArtifactFixture() },
      consumerDirectory,
      profile,
    })).rejects.toThrow('outside the clean consumer')
  })
})

describe('package archive inspection', () => {
  it('rejects traversal segments before extracting the archive', async () => {
    const archiveDirectory = await createTemporaryDirectory('archive-inspection')
    const commandRunner = vi.fn(async () => ({
      stdout: 'package/package.json\npackage/../outside.mjs\n',
    }))
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
      commandRunner,
    })

    await expect(operations.inspectArchive({
      archiveDirectory,
      artifact: createArtifactFixture(),
    })).rejects.toThrow('Package archive contains an unsafe entry: package/../outside.mjs')
    expect(commandRunner).toHaveBeenCalledTimes(1)
  })

  it('accepts metadata, exports, and declarations that exist inside the archive', async () => {
    const archivePath = await createPackageArchive(createContractManifest({
      main: './dist/module.mjs',
      exports: {
        '.': {
          types: './dist/types.d.mts',
          import: './dist/module.mjs',
          default: './dist/module.mjs',
        },
      },
      typesVersions: {
        '*': {
          '.': ['./dist/types.d.mts'],
        },
      },
    }), [
      'dist/module.mjs',
      'dist/types.d.mts',
    ])
    const archiveDirectory = await createTemporaryDirectory('archive-inspection')
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
    })

    await expect(operations.inspectArchive({
      archiveDirectory,
      artifact: createArtifactFixture({ archivePath }),
    })).resolves.toBeUndefined()
  })

  it.each([
    ['engines.node', { engines: { node: '>=20.0.0' } }],
    ['peerDependencies.nuxt', {
      peerDependencies: {
        '@nuxt/content': '>=3.5.0 <4.0.0',
        'nuxt': '^3.20.1 || ^4.1.0',
      },
    }],
    ['peerDependencies.@nuxt/content', {
      peerDependencies: {
        '@nuxt/content': '^3.15.2',
        'nuxt': '^4.1.0',
      },
    }],
    ['dependencies.@nuxt/kit', {
      dependencies: {
        '@nuxt/kit': '4.5.2',
        'mermaid': '~11.16.1',
      },
    }],
    ['dependencies.mermaid', {
      dependencies: {
        '@nuxt/kit': '^4.5.2',
        'mermaid': '^11.16.1',
      },
    }],
  ])('rejects a packed artifact with the wrong %s contract', async (field, overrides) => {
    const archivePath = await createPackageArchive(
      createContractManifest(overrides),
      ['dist/module.mjs'],
    )
    const archiveDirectory = await createTemporaryDirectory('archive-inspection')
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
    })

    await expect(operations.inspectArchive({
      archiveDirectory,
      artifact: createArtifactFixture({ archivePath }),
    })).rejects.toThrow(`Archive dependency contract mismatch: ${field}`)
  })

  it('rejects a declaration target missing from the archive', async () => {
    const archivePath = await createPackageArchive(createContractManifest({
      exports: {
        '.': {
          types: './dist/types.d.mts',
          import: './dist/module.mjs',
        },
      },
    }), ['dist/module.mjs'])
    const archiveDirectory = await createTemporaryDirectory('archive-inspection')
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
    })

    await expect(operations.inspectArchive({
      archiveDirectory,
      artifact: createArtifactFixture({ archivePath }),
    })).rejects.toThrow('Archive target does not exist: ./dist/types.d.mts')
  })

  it('rejects an export target that escapes the package boundary', async () => {
    const archivePath = await createPackageArchive(createContractManifest({
      exports: {
        '.': '../outside.mjs',
      },
    }), [])
    const archiveDirectory = await createTemporaryDirectory('archive-inspection')
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
    })

    await expect(operations.inspectArchive({
      archiveDirectory,
      artifact: createArtifactFixture({ archivePath }),
    })).rejects.toThrow('Archive target escapes the package boundary: ../outside.mjs')
  })
})

describe('package artifact creation', () => {
  it('formats the immutable artifact checksum contract', () => {
    expect(formatArtifactChecksum(createArtifactFixture({
      filename: 'package-3.0.0.tgz',
      integritySha512: 'sha512-Zml4dHVyZQ==',
    }))).toBe('sha512-Zml4dHVyZQ==  package-3.0.0.tgz\n')
  })

  it('returns the identity of the single tarball produced by pnpm pack', async () => {
    const repositoryRoot = await createTemporaryDirectory('package-repository')
    const artifactDirectory = await createTemporaryDirectory('package-artifact')
    const archiveBytes = Buffer.from('one publishable artifact')
    const filename = 'barzhsieh-nuxt-content-mermaid-2.2.3.tgz'
    const commandRunner = vi.fn(async () => {
      await writeFile(join(artifactDirectory, filename), archiveBytes)
      return {
        stdout: `prepack lifecycle output\n${JSON.stringify({
          name: '@barzhsieh/nuxt-content-mermaid',
          version: '2.2.3',
          filename: join(artifactDirectory, filename),
          files: [
            { path: 'LICENSE' },
            { path: 'README.md' },
            { path: 'README.zh-TW.md' },
            { path: 'dist/module.mjs' },
            { path: 'dist/types.d.mts' },
            { path: 'package.json' },
          ],
        })}`,
      }
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
      commandRunner,
    })

    await expect(operations.createArtifact({
      repositoryRoot,
      artifactDirectory,
    })).resolves.toEqual({
      archivePath: join(artifactDirectory, filename),
      filename,
      sha256: createHash('sha256').update(archiveBytes).digest('hex'),
      integritySha512: `sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`,
      packlist: [
        'LICENSE',
        'README.md',
        'README.zh-TW.md',
        'dist/module.mjs',
        'dist/types.d.mts',
        'package.json',
      ],
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '2.2.3',
    })
    expect(commandRunner).toHaveBeenCalledWith({
      command: 'pnpm',
      args: ['pack', '--json', '--pack-destination', artifactDirectory],
      cwd: repositoryRoot,
    })
  })

  it('rejects a packing result that produced more than one tarball', async () => {
    const repositoryRoot = await createTemporaryDirectory('package-repository')
    const artifactDirectory = await createTemporaryDirectory('package-artifact')
    const commandRunner = vi.fn(async () => {
      await writeFile(join(artifactDirectory, 'first.tgz'), 'first')
      await writeFile(join(artifactDirectory, 'second.tgz'), 'second')
      return {
        stdout: JSON.stringify([{
          name: '@barzhsieh/nuxt-content-mermaid',
          version: '2.2.3',
          filename: 'first.tgz',
        }]),
      }
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
      commandRunner,
    })

    await expect(operations.createArtifact({
      repositoryRoot,
      artifactDirectory,
    })).rejects.toThrow('pnpm pack must produce exactly one tarball; found 2')
  })

  it.each([
    'playground/app.vue',
    'docs/internal-notes.md',
    '.output/public/index.html',
    'debug/request-log.json',
  ])('rejects non-package surface in the publishable artifact: %s', async (unexpectedPath) => {
    const repositoryRoot = await createTemporaryDirectory('package-repository')
    const artifactDirectory = await createTemporaryDirectory('package-artifact')
    const filename = 'barzhsieh-nuxt-content-mermaid-3.0.0.tgz'
    const commandRunner = vi.fn(async () => {
      await writeFile(join(artifactDirectory, filename), 'artifact')
      return {
        stdout: JSON.stringify({
          name: '@barzhsieh/nuxt-content-mermaid',
          version: '3.0.0',
          filename,
          files: [
            { path: 'dist/module.mjs' },
            { path: 'package.json' },
            { path: unexpectedPath },
          ],
        }),
      }
    })
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
      commandRunner,
    })

    await expect(operations.createArtifact({
      repositoryRoot,
      artifactDirectory,
    })).rejects.toThrow(`Publishable Package Artifact contains an unexpected path: ${unexpectedPath}`)
  })
})

describe('existing package artifact loading', () => {
  it('reconstructs deterministic identity from one checksummed tarball', async () => {
    const archivePath = await createPackageArchive(
      createContractManifest(),
      ['dist/module.mjs', 'dist/types.d.mts'],
    )
    const checksumPath = await writeArtifactChecksum(archivePath)
    const commandRunner = vi.fn(runCommand)
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
      commandRunner,
    })
    const archiveBytes = await readFile(archivePath)

    await expect(operations.loadArtifact({
      archivePath,
      checksumPath,
    })).resolves.toEqual({
      archivePath,
      filename: basename(archivePath),
      sha256: createHash('sha256').update(archiveBytes).digest('hex'),
      integritySha512: `sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`,
      packlist: [
        'dist/module.mjs',
        'dist/types.d.mts',
        'package.json',
      ],
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '2.2.3',
      packageContract: {
        node: '>=22.19.0',
        nuxt: '^4.1.0',
        nuxtContent: '>=3.5.0 <4.0.0',
        nuxtKit: '^4.5.2',
        mermaid: '~11.16.1',
      },
    })
    expect(commandRunner.mock.calls.flatMap(([invocation]) => (
      [invocation.command, ...invocation.args]
    )).join(' ')).not.toMatch(/pnpm pack|prepack|prepare/)
  })

  it('checks SHA-512 before inspecting the archive', async () => {
    const archivePath = await createPackageArchive(createContractManifest(), [])
    const checksumPath = await writeArtifactChecksum(
      archivePath,
      'sha512-ZGlmZmVyZW50',
    )
    const commandRunner = vi.fn()
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
      commandRunner,
    })

    await expect(operations.loadArtifact({
      archivePath,
      checksumPath,
    })).rejects.toThrow('SHA-512 mismatch')
    expect(commandRunner).not.toHaveBeenCalled()
  })

  it('rejects a second tarball in the workflow artifact directory', async () => {
    const archivePath = await createPackageArchive(createContractManifest(), [])
    const checksumPath = await writeArtifactChecksum(archivePath)
    await writeFile(join(dirname(archivePath), 'second.tgz'), 'second')
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
    })

    await expect(operations.loadArtifact({
      archivePath,
      checksumPath,
    })).rejects.toThrow('exactly one tarball; found 2')
  })

  it('rejects an unsafe archive entry while reconstructing the packlist', async () => {
    const archivePath = await createPackageArchive(createContractManifest(), [])
    const checksumPath = await writeArtifactChecksum(archivePath)
    const commandRunner = vi.fn(async () => ({
      stdout: 'package/package.json\npackage/../outside.mjs\n',
    }))
    const operations = createReleaseVerificationOperations({
      templateDirectory: '/unused',
      commandRunner,
    })

    await expect(operations.loadArtifact({
      archivePath,
      checksumPath,
    })).rejects.toThrow('unsafe entry: package/../outside.mjs')
  })
})

describe('command execution diagnostics', () => {
  it('classifies runner, network, and missing-browser failures before they reach drift policy', () => {
    const missingCommand = Object.assign(new Error('spawn vue-tsc ENOENT'), {
      code: 'ENOENT',
    })
    const failedFetch = new Error('fetch failed', {
      cause: Object.assign(new Error('network unreachable'), { code: 'ENETUNREACH' }),
    })
    const npmDownloadFailure = Object.assign(new Error('npm install failed'), {
      code: 1,
      stderr: 'npm error code ENETUNREACH\nnpm error network unreachable',
    })
    const missingBrowser = new Error('browserType.launch: Executable doesn\'t exist')

    expect(classifyInfrastructureCause(missingCommand)).toBe(true)
    expect(classifyInfrastructureCause(failedFetch)).toBe(true)
    expect(classifyInfrastructureCause(npmDownloadFailure, npmDownloadFailure.stderr)).toBe(true)
    expect(classifyInfrastructureCause(missingBrowser)).toBe(true)
    expect(classifyInfrastructureCause(new Error('Type contract failed'))).toBe(false)
  })

  it('marks an unavailable executable as an infrastructure error', async () => {
    await expect(runCommand({
      command: join(process.cwd(), 'missing-release-verification-runner'),
      args: [],
      cwd: process.cwd(),
    })).rejects.toBeInstanceOf(ReleaseVerificationInfrastructureError)
  })

  it('includes stdout and stderr when a required command fails', async () => {
    const operationsModule = await import('../scripts/release-verification/operations.mjs') as typeof import('../scripts/release-verification/operations.mjs') & {
      runCommand: (input: {
        command: string
        args: string[]
        cwd: string
      }) => Promise<unknown>
    }

    await expect(operationsModule.runCommand({
      command: process.execPath,
      args: [
        '-e',
        'console.log("type diagnostic stdout"); console.error("type diagnostic stderr"); process.exit(2)',
      ],
      cwd: process.cwd(),
    })).rejects.toThrow(/type diagnostic stdout[\s\S]*type diagnostic stderr/)
  })
})
