import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { verifyWebsiteArtifactIdentity } from '../scripts/website/artifact.mjs'
import { loadWebsiteReferenceCorpus, WEBSITE_REFERENCE_CORPUS_PATH } from '../scripts/website/reference-corpus.mjs'
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
