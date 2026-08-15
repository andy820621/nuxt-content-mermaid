import { describe, expect, it } from 'vitest'
import { verifyWebsiteArtifactIdentity } from '../scripts/website/artifact.mjs'
import type { LoadedReferenceRecords } from '../scripts/website/reference-parity.mjs'

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

function recordObject(records: unknown[], path: string) {
  const record = records.find((candidate): candidate is Record<string, unknown> => (
    typeof candidate === 'object'
    && candidate !== null
    && 'path' in candidate
    && candidate.path === path
  ))
  if (!record) throw new Error(`Missing Reference fixture: ${path}`)
  return record
}

function objectField(record: Record<string, unknown>, field: string) {
  const value = record[field]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Missing Reference object field: ${record.path}.${field}`)
  }
  return value as Record<string, unknown>
}

describe('website public Reference projection', () => {
  it('loads a build-time projection without resolving a second artifact identity', async () => {
    const { loadWebsiteReferencePublicModel } = await import('../scripts/website/reference-public.mjs')

    await expect(loadWebsiteReferencePublicModel()).resolves.toMatchObject({
      identity: '@barzhsieh/nuxt-content-mermaid@3.0.0',
      recordCount: 43,
    })
  })

  it('projects all validated records without private verification evidence', async () => {
    const { loadWebsiteReferencePublicModel } = await import('../scripts/website/reference-public.mjs')
    const model = await loadWebsiteReferencePublicModel({ artifact: await exactInstalledArtifact() })

    expect(model).toMatchObject({
      identity: '@barzhsieh/nuxt-content-mermaid@3.0.0',
      recordCount: 43,
      sections: {
        configurationGroups: expect.any(Array),
        configurationValues: expect.any(Array),
        authoringInputs: expect.any(Array),
        delegatedPayloads: expect.any(Array),
        deprecatedOptions: expect.any(Array),
      },
    })
    expect(Object.values(model.sections).map(records => records.length)).toEqual([10, 22, 4, 6, 1])
    expect(JSON.stringify(model)).not.toMatch(/artifact:|evidence|artifactRoot|manifestPath|\.pnpm|\/Users\/|#ModuleOptions|minimumExample[^}]*"id"/)
  })

  it('allowlists every nested public structure after the model has been validated', async () => {
    const { loadWebsiteReferenceCorpus } = await import('../scripts/website/reference-corpus.mjs')
    const { projectWebsiteReferencePublicModel } = await import('../scripts/website/reference-public.mjs')
    const records = await loadWebsiteReferenceCorpus({ artifact: await exactInstalledArtifact() })
    const baseline = projectWebsiteReferencePublicModel(records)
    const tampered = structuredClone(records) as unknown as Array<Record<string, unknown>>
    const loaderInit = recordObject(tampered, 'loader.init')
    const enabled = recordObject(tampered, 'enabled')
    const delegated = recordObject(tampered, 'delegated.component-direct-config')
    const occurrence = (loaderInit.occurrences as Array<Record<string, unknown>>)[0]

    if (!occurrence) throw new Error('Missing loader.init occurrence fixture')
    occurrence.evidence = ['artifact:dist/runtime/private.mjs#probe']
    occurrence.artifactRoot = '/Users/private/node_modules/.pnpm/package'
    objectField(loaderInit, 'deprecation').manifestPath = '/Users/private/package.json'
    objectField(loaderInit, 'default').evidence = ['artifact:dist/runtime/private.mjs#default']
    const defaultValue = objectField(objectField(loaderInit, 'default'), 'value')
    defaultValue.evidence = ['artifact:dist/runtime/private.mjs#default-value']
    defaultValue.artifactRoot = '/Users/private/default-value'
    objectField(objectField(objectField(loaderInit, 'default'), 'outcomes'), 'debug:false').manifestPath = '/Users/private/debug-false'
    objectField(enabled, 'supportedConstraint').artifactRoot = '/Users/private/artifact'
    objectField(enabled, 'recommendedRange').evidence = ['reference-probe:range']
    objectField(enabled, 'localValidation').manifestPath = '/Users/private/manifest'
    objectField(delegated, 'packageFields').evidence = ['artifact:dist/runtime/private.mjs#fields']
    objectField(delegated, 'allowances').probeId = 'reference-probe:allowances'

    const projected = projectWebsiteReferencePublicModel(tampered as unknown as LoadedReferenceRecords)

    expect(projected).toEqual(baseline)
    expect(JSON.stringify(projected)).not.toMatch(/artifact:|evidence|artifactRoot|manifestPath|\.pnpm|\/Users\/|reference-probe:/)
  })

  it('preserves exact conditional defaults and kind-specific public semantics', async () => {
    const { loadWebsiteReferencePublicModel } = await import('../scripts/website/reference-public.mjs')
    const model = await loadWebsiteReferencePublicModel({ artifact: await exactInstalledArtifact() })
    const records = Object.values(model.sections).flat()
    const loaderInit = records.find(record => record.path === 'loader.init')
    const authoring = records.find(record => record.path === 'authoring.markdown.fence')
    const delegated = records.find(record => record.path === 'delegated.component-direct-config')

    expect(loaderInit?.kind).toBe('configuration-group')
    if (loaderInit?.kind !== 'configuration-group') throw new Error('loader.init must be a configuration group')
    expect(loaderInit.default).toEqual({
      kind: 'conditional',
      value: {
        startOnLoad: false,
        theme: 'default',
        fontFamily: 'Arial, sans-serif, 微軟正黑體',
        securityLevel: 'strict',
      },
      outcomes: {
        'debug:false': { logLevel: 5, suppressErrorRendering: true },
        'debug:true': { logLevel: 1, suppressErrorRendering: false },
      },
      summary: 'Package defaults plus debug-derived fields unless explicitly overridden.',
    })
    expect(loaderInit).not.toHaveProperty('errorSemantics')
    expect(loaderInit).not.toHaveProperty('supportedConstraint')
    expect(authoring).toMatchObject({
      kind: 'authoring-input',
      syntax: expect.any(String),
      transportTarget: expect.any(String),
      sourcePrecedence: expect.any(Array),
      downstreamOwnership: expect.any(String),
    })
    expect(authoring).not.toHaveProperty('default')
    expect(authoring).not.toHaveProperty('reset')
    expect(delegated).toMatchObject({
      kind: 'delegated-exception',
      delegatedOwner: expect.any(String),
      transportRestrictions: expect.any(Array),
      packageFields: { set: expect.any(Array), read: expect.any(Array) },
      unknownKeyPolicy: expect.any(String),
      allowances: expect.any(Object),
      exclusions: expect.any(Array),
      packageBehavior: expect.any(String),
    })
  })

  it('assigns every record to one section with one stable unique fragment', async () => {
    const { loadWebsiteReferencePublicModel } = await import('../scripts/website/reference-public.mjs')
    const model = await loadWebsiteReferencePublicModel({ artifact: await exactInstalledArtifact() })
    const records = Object.values(model.sections).flat()
    const fragments = records.map(record => record.fragment)

    expect(records).toHaveLength(43)
    expect(new Set(fragments)).toHaveLength(43)
    expect(model.sections.deprecatedOptions.map(record => record.path)).toEqual(['theme.useColorModeTheme'])
    expect(model.sections.configurationValues.map(record => record.path)).not.toContain('theme.useColorModeTheme')
  })
})
