import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReleaseVerificationOperations } from '../scripts/release-verification/operations.mjs'
import type { PackageArtifact } from '../scripts/release-verification/runner.mjs'

const temporaryDirectories: string[] = []
const execFileAsync = promisify(execFile)

const profile = {
  id: 'nuxt-4-known-latest',
  versions: {
    betterSqlite3: '12.11.1',
    nuxt: '4.5.2',
    nuxtContent: '3.15.2',
    mermaid: '11.12.3',
    typescript: '5.9.3',
    vueTsc: '3.2.5',
  },
}

function createArtifactFixture(overrides: Partial<PackageArtifact> = {}): PackageArtifact {
  return {
    archivePath: '/tmp/package.tgz',
    filename: 'package.tgz',
    sha256: 'abc123',
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

async function populateInstalledPackages(consumerDirectory: string) {
  await createInstalledPackage(consumerDirectory, '@barzhsieh/nuxt-content-mermaid', '2.2.3')
  await createInstalledPackage(consumerDirectory, 'better-sqlite3', profile.versions.betterSqlite3)
  await createInstalledPackage(consumerDirectory, 'nuxt', profile.versions.nuxt)
  await createInstalledPackage(consumerDirectory, '@nuxt/content', profile.versions.nuxtContent)
  await createInstalledPackage(consumerDirectory, 'mermaid', profile.versions.mermaid)
  await createInstalledPackage(consumerDirectory, 'typescript', profile.versions.typescript)
  await createInstalledPackage(consumerDirectory, 'vue-tsc', profile.versions.vueTsc)
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

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, {
    recursive: true,
    force: true,
  })))
})

describe('clean consumer installation', () => {
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
      artifact: createArtifactFixture({ archivePath }),
      consumerDirectory,
      profile,
    })

    const packageJson = JSON.parse(await readFile(join(consumerDirectory, 'package.json'), 'utf8'))
    expect(packageJson.dependencies).toEqual({
      '@barzhsieh/nuxt-content-mermaid': pathToFileURL(archivePath).href,
      '@nuxt/content': '3.15.2',
      'better-sqlite3': '12.11.1',
      'mermaid': '11.12.3',
      'nuxt': '4.5.2',
    })
    expect(packageJson.devDependencies).toEqual({
      'typescript': '5.9.3',
      'vue-tsc': '3.2.5',
    })
    expect(resolved).toEqual(profile.versions)
    expect(commandRunner).toHaveBeenCalledOnce()
  })

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
      artifact: createArtifactFixture(),
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
      artifact: createArtifactFixture(),
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
      artifact: createArtifactFixture(),
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
      artifact: createArtifactFixture(),
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
    const archivePath = await createPackageArchive({
      name: '@barzhsieh/nuxt-content-mermaid',
      version: '2.2.3',
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
    }, [
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

  it('rejects a declaration target missing from the archive', async () => {
    const archivePath = await createPackageArchive({
      name: '@barzhsieh/nuxt-content-mermaid',
      version: '2.2.3',
      exports: {
        '.': {
          types: './dist/types.d.mts',
          import: './dist/module.mjs',
        },
      },
    }, ['dist/module.mjs'])
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
    const archivePath = await createPackageArchive({
      name: '@barzhsieh/nuxt-content-mermaid',
      version: '2.2.3',
      exports: {
        '.': '../outside.mjs',
      },
    }, [])
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
})

describe('command execution diagnostics', () => {
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
