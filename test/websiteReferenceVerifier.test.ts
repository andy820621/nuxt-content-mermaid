import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyWebsiteArtifactIdentity } from '../scripts/website/artifact.mjs'
import { loadWebsiteReferenceCorpus, WEBSITE_REFERENCE_CORPUS_PATH } from '../scripts/website/reference-corpus.mjs'
import { discoverPublicDeclarations, runSemanticTypeScriptProbes } from '../scripts/website/reference-parity.mjs'
import { verifyWebsiteReference } from '../scripts/website/reference-verifier.mjs'

type RawReferenceRecord = Record<string, unknown> & {
  artifactVersion?: string
  children?: unknown[]
  default?: Record<string, unknown>
  deprecation?: Record<string, unknown>
  evidence?: string[]
  minimumExample?: Record<string, unknown>
  occurrences?: Array<Record<string, unknown>>
  path?: string
  supportedConstraint?: Record<string, unknown> & { evidence?: string[] }
  unknownKeyPolicy?: string
  valueType?: string
}

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function exactInstalledArtifact() {
  return verifyWebsiteArtifactIdentity({
    fetchRegistryMetadata: async () => ({
      name: '@barzhsieh/nuxt-content-mermaid',
      version: '3.0.0',
      dist: {
        integrity: 'sha512-kEruFkDptMGvmqS+XAB7lQS8CEaC5BAZOjJc/TINDXOFAeUlAkDDGBmAkLEI9L4XbI8jmMUlspjRel5At90v0Q==',
        tarball: 'https://registry.npmjs.org/@barzhsieh/nuxt-content-mermaid/-/nuxt-content-mermaid-3.0.0.tgz',
      },
    }),
  })
}

async function verifyTamperedCorpus(
  mutate: (records: RawReferenceRecord[]) => void,
) {
  const artifact = await exactInstalledArtifact()
  const records = JSON.parse(await readFile(WEBSITE_REFERENCE_CORPUS_PATH, 'utf8')) as RawReferenceRecord[]
  mutate(records)
  return verifyWebsiteReference({
    resolveArtifact: async () => artifact,
    loadCorpus: options => loadWebsiteReferenceCorpus({
      ...options,
      readText: async () => JSON.stringify(records),
    }),
    verifySnippets: async () => ({ typescript: true, markdown: true }),
  })
}

async function copyExactArtifact(prefix: string) {
  const exact = await exactInstalledArtifact()
  const root = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(root)
  const artifactRoot = join(root, 'package')
  await cp(exact.artifactRoot, artifactRoot, { recursive: true })
  await rm(join(artifactRoot, 'node_modules'), { recursive: true, force: true })
  await symlink(join(exact.artifactRoot, 'node_modules'), join(artifactRoot, 'node_modules'), 'dir')
  await symlink(join(process.cwd(), 'node_modules'), join(root, 'node_modules'), 'dir')
  return { artifactRoot, exact }
}

async function copiedArtifactWithMutation(
  relativePath: string,
  mutate: (source: string) => string,
) {
  const { artifactRoot, exact } = await copyExactArtifact('reference-verifier-artifact-')
  const targetPath = join(artifactRoot, relativePath)
  const source = await readFile(targetPath, 'utf8')
  const mutated = mutate(source)
  if (mutated === source) throw new Error(`Artifact mutation fixture did not change ${relativePath}`)
  await writeFile(targetPath, mutated)
  return {
    ...exact,
    artifactRoot,
    manifestPath: join(artifactRoot, 'package.json'),
    moduleEntryPath: join(artifactRoot, 'dist/module.mjs'),
  }
}

function copiedArtifactWithConfigurationMutation(mutate: (source: string) => string) {
  return copiedArtifactWithMutation('dist/runtime/configuration/module.js', mutate)
}

async function copiedArtifactWithRelocatedRuntime() {
  const { artifactRoot, exact } = await copyExactArtifact('reference-verifier-layout-')

  await mkdir(join(artifactRoot, 'bundle'), { recursive: true })
  await rename(join(artifactRoot, 'dist/runtime'), join(artifactRoot, 'bundle/runtime'))
  await mkdir(join(artifactRoot, 'dist/runtime/types'), { recursive: true })
  await cp(
    join(artifactRoot, 'bundle/runtime/types/expand.d.ts'),
    join(artifactRoot, 'dist/runtime/types/expand.d.ts'),
  )

  const moduleEntryPath = join(artifactRoot, 'dist/module.mjs')
  const moduleSource = await readFile(moduleEntryPath, 'utf8')
  await writeFile(
    moduleEntryPath,
    moduleSource
      .replaceAll('../dist/runtime/', '../bundle/runtime/')
      .replace('resolver.resolve("./runtime")', 'resolver.resolve("../bundle/runtime")')
      .replace('resolver.resolve("./runtime/styles.css")', 'resolver.resolve("../bundle/runtime/styles.css")'),
  )
  const manifestPath = join(artifactRoot, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>
  manifest.files = ['dist', 'bundle']
  await writeFile(manifestPath, JSON.stringify(manifest))

  return {
    artifact: {
      ...exact,
      artifactRoot,
      manifestPath,
      moduleEntryPath,
    },
    relocateEvidence: (records: RawReferenceRecord[]) => {
      for (const record of records) {
        record.evidence = record.evidence?.map(identifier => identifier.replace(
          'artifact:dist/runtime/',
          'artifact:bundle/runtime/',
        ))
        if (record.supportedConstraint?.evidence) {
          record.supportedConstraint.evidence = record.supportedConstraint.evidence.map(identifier => identifier.replace(
            'artifact:dist/runtime/',
            'artifact:bundle/runtime/',
          ))
        }
      }
    },
  }
}

describe('focused website Reference verifier', () => {
  it('resolves the exact artifact once and validates the complete corpus and snippets', async () => {
    const { verifyWebsiteReference } = await import('../scripts/website/reference-verifier.mjs')
    const artifact = await exactInstalledArtifact()
    let artifactResolutions = 0
    const result = await verifyWebsiteReference({
      resolveArtifact: async () => {
        artifactResolutions += 1
        return artifact
      },
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(artifactResolutions).toBe(1)
    expect(result).toMatchObject({
      artifact: { version: '3.0.0' },
      recordCount: 43,
      mismatches: [],
    })
  }, 15_000)

  it('classifies unreadable verification infrastructure deterministically', async () => {
    const { verifyWebsiteReference } = await import('../scripts/website/reference-verifier.mjs')
    const result = await verifyWebsiteReference({
      resolveArtifact: async () => {
        throw new Error('artifact resolver unavailable')
      },
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result.mismatches).toEqual([{ category: 'unreadable-verification-infrastructure' }])
  })

  it('exposes a focused CLI result without private artifact paths', async () => {
    const verifierModule = await import('../scripts/website/reference-verifier.mjs') as unknown as {
      runWebsiteReferenceCli?: (options: Record<string, unknown>) => Promise<unknown>
    }
    expect(verifierModule.runWebsiteReferenceCli).toBeTypeOf('function')
    const output: string[] = []
    const result = await verifierModule.runWebsiteReferenceCli!({
      verifyReference: async () => ({
        artifact: { packageName: '@barzhsieh/nuxt-content-mermaid', version: '3.0.0' },
        recordCount: 43,
        mismatches: [],
      }),
      writeOutput: (value: string) => output.push(value),
    })

    expect(result).toMatchObject({ recordCount: 43, mismatches: [] })
    expect(output).toHaveLength(1)
    expect(output[0]).toContain('@barzhsieh/nuxt-content-mermaid@3.0.0')
    expect(output[0]).not.toMatch(/\.pnpm|artifactRoot|\/Users\//)
  })

  it('fails closed when the artifact keeps its symbols and public types but changes a Supported Constraint boundary', async () => {
    const artifact = await copiedArtifactWithConfigurationMutation(source => source.replace(
      'for (const key of ["renderer", "spinner", "error"]) assertStringProperty(components, key, phase, ["components"]);',
      'assertBooleanProperty(components, "renderer", phase, ["components"]);\n    for (const key of ["spinner", "error"]) assertStringProperty(components, key, phase, ["components"]);',
    ))
    const declarations = await discoverPublicDeclarations(artifact)
    expect((await runSemanticTypeScriptProbes(artifact, declarations)).filter(probe => !probe.passed)).toEqual([])

    const result = await verifyWebsiteReference({
      resolveArtifact: async () => artifact,
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result.mismatches).toContainEqual({ category: 'unsupported-constraint-evidence' })
  }, 15_000)

  it('fails closed when the artifact keeps its resolver symbol but reverses module/runtime precedence', async () => {
    const artifact = await copiedArtifactWithConfigurationMutation(source => source.replace(
      'DEFAULT_RUNTIME_OPTIONS,\n    runtimeLayerWithoutActivation(nuxtResolvedOptions),\n    runtimeOverrides',
      'DEFAULT_RUNTIME_OPTIONS,\n    runtimeOverrides,\n    runtimeLayerWithoutActivation(nuxtResolvedOptions)',
    ))
    const declarations = await discoverPublicDeclarations(artifact)
    expect((await runSemanticTypeScriptProbes(artifact, declarations)).filter(probe => !probe.passed)).toEqual([])

    const result = await verifyWebsiteReference({
      resolveArtifact: async () => artifact,
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result.mismatches).toContainEqual({ category: 'precedence-mismatch' })
  }, 15_000)

  it('fails closed when a sparse runtime layer replaces nested module values instead of merging them', async () => {
    const artifact = await copiedArtifactWithConfigurationMutation(source => source.replace(
      'runtimeOptions.expand = resolveExpandOptions([\n    hasOwn(nuxtResolvedOptions, "expand") ? descriptorValue(nuxtResolvedOptions, "expand") : void 0,\n    hasOwn(runtimeOverrides, "expand") ? descriptorValue(runtimeOverrides, "expand") : void 0\n  ]);',
      'runtimeOptions.expand = resolveExpandOptions([\n    hasOwn(runtimeOverrides, "expand")\n      ? descriptorValue(runtimeOverrides, "expand")\n      : hasOwn(nuxtResolvedOptions, "expand")\n        ? descriptorValue(nuxtResolvedOptions, "expand")\n        : void 0\n  ]);',
    ))

    const result = await verifyWebsiteReference({
      resolveArtifact: async () => artifact,
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result.mismatches).toContainEqual({ category: 'precedence-mismatch' })
  }, 15_000)

  it('fails closed when the component source symbol remains but conflicting props stop winning', async () => {
    const artifact = await copiedArtifactWithMutation(
      'dist/runtime/component-configuration.js',
      source => source.replace(
        'if (hasPageConfig && hasDirectConfig) return "conflict";',
        'if (hasPageConfig && hasDirectConfig) return "page";',
      ),
    )

    const result = await verifyWebsiteReference({
      resolveArtifact: async () => artifact,
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result.mismatches).toContainEqual({ category: 'precedence-mismatch' })
  }, 15_000)

  it('fails closed when the Mermaid config symbol remains but runtime overrides page config', async () => {
    const artifact = await copiedArtifactWithMutation(
      'dist/runtime/mermaid-config.js',
      source => source.replace(
        'runtimeWorkingCopy,\n      options.source.config',
        'options.source.config,\n      runtimeWorkingCopy',
      ),
    )

    const result = await verifyWebsiteReference({
      resolveArtifact: async () => artifact,
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result.mismatches).toContainEqual({ category: 'precedence-mismatch' })
  }, 15_000)

  it('fails closed when the module hook symbol remains but Markdown frontmatter overrides inline data', async () => {
    const artifact = await copiedArtifactWithMutation(
      'dist/module.mjs',
      source => source.replace(
        'frontmatterInfo?.data.toolbar,\n      inlineOverrides?.toolbar',
        'inlineOverrides?.toolbar,\n      frontmatterInfo?.data.toolbar',
      ),
    )

    const result = await verifyWebsiteReference({
      resolveArtifact: async () => artifact,
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result.mismatches).toContainEqual({ category: 'precedence-mismatch' })
  }, 20_000)

  it('verifies the same runtime authorities after a manifest-declared artifact layout change', async () => {
    const { artifact, relocateEvidence } = await copiedArtifactWithRelocatedRuntime()
    const records = JSON.parse(await readFile(WEBSITE_REFERENCE_CORPUS_PATH, 'utf8')) as RawReferenceRecord[]
    relocateEvidence(records)

    const result = await verifyWebsiteReference({
      resolveArtifact: async () => artifact,
      loadCorpus: options => loadWebsiteReferenceCorpus({
        ...options,
        readText: async () => JSON.stringify(records),
      }),
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result).toMatchObject({ recordCount: 43, mismatches: [] })
  }, 15_000)

  it.each([
    ['path', (records: RawReferenceRecord[]) => { records[1]!.path = 'future' }, ['extra-path', 'missing-path', 'type-mismatch']],
    ['type', (records: RawReferenceRecord[]) => { records[1]!.valueType = 'string' }, ['type-mismatch']],
    ['default', (records: RawReferenceRecord[]) => { records[1]!.default!.value = true }, ['default-mismatch']],
    ['evidence', (records: RawReferenceRecord[]) => { records[1]!.evidence = ['artifact:dist/module.d.mts#MissingReferenceSymbol'] }, ['unsupported-constraint-evidence']],
    ['unrelated record evidence', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'debug')!.evidence![0]
        = 'artifact:dist/module.d.mts#ModuleOptions'
    }, ['unsupported-constraint-evidence']],
    ['unrelated Supported Constraint evidence', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'debug')!.supportedConstraint!.evidence
        = ['artifact:dist/module.d.mts#ModuleOptions']
    }, ['unsupported-constraint-evidence']],
    ['snippet', (records: RawReferenceRecord[]) => { records[1]!.minimumExample!.source = 'const options: ModuleOptions = { debug: 1 }' }, ['snippet-failure']],
    ['version', (records: RawReferenceRecord[]) => { records[1]!.artifactVersion = '3.0.1' }, ['artifact-version-mismatch']],
    ['deprecation', (records: RawReferenceRecord[]) => { records[7]!.deprecation!.status = 'active' }, ['deprecation-mismatch']],
    ['exception', (records: RawReferenceRecord[]) => { records.splice(37, 1) }, ['exception-mismatch', 'extra-path']],
    ['occurrence', (records: RawReferenceRecord[]) => {
      (records[1]!.occurrences as unknown[]).pop()
    }, ['delegated-descendant']],
    ['omitted default', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'components.renderer')!.default = {
        kind: 'literal',
        summary: 'Tampered renderer default.',
        value: 'WrongRenderer',
      }
    }, ['default-mismatch']],
    ['exception policy', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'delegated.loader-init')!.unknownKeyPolicy
        = 'Drop every unknown key.'
    }, ['exception-mismatch']],
    ['toolbar occurrence precedence', (records: RawReferenceRecord[]) => {
      const record = records.find(candidate => candidate.path === 'toolbar.title')!
      const occurrence = record.occurrences!.find(candidate => candidate.surface === 'Mermaid YAML frontmatter')!
      occurrence.precedence = 'Application default wins.'
    }, ['delegated-descendant']],
    ['group children', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'loader')!.children = ['future']
    }, ['delegated-descendant']],
    ['group child element', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'loader')!.children = [42]
    }, ['type-mismatch']],
    ['configuration occurrence semantics', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'debug')!.occurrences![0]!.scope = 'diagram'
    }, ['delegated-descendant']],
    ['authoring occurrence semantics', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'authoring.markdown.fence')!
        .occurrences![0]!.precedence = 'Page data overrides fence data.'
    }, ['delegated-descendant']],
    ['delegated occurrence semantics', (records: RawReferenceRecord[]) => {
      records.find(record => record.path === 'delegated.component-page-config')!
        .occurrences![0]!.scope = 'application'
    }, ['delegated-descendant']],
  ])('classifies a tampered %s deterministically', async (_label, mutate, expectedCategories) => {
    const result = await verifyTamperedCorpus(mutate)
    expect(result.mismatches.map(mismatch => mismatch.category)).toEqual(expect.arrayContaining(expectedCategories))
  }, 15_000)

  it('never generates or mutates the human-authored corpus', async () => {
    const before = await readFile(WEBSITE_REFERENCE_CORPUS_PATH, 'utf8')
    const artifact = await exactInstalledArtifact()

    const result = await verifyWebsiteReference({
      resolveArtifact: async () => artifact,
      verifySnippets: async () => ({ typescript: true, markdown: true }),
    })

    expect(result.mismatches).toEqual([])
    await expect(readFile(WEBSITE_REFERENCE_CORPUS_PATH, 'utf8')).resolves.toBe(before)
  }, 15_000)
})
