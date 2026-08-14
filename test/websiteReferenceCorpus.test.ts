import { describe, expect, it } from 'vitest'
import { verifyWebsiteArtifactIdentity } from '../scripts/website/artifact.mjs'
import { CONFIGURATION_INVENTORY, DIRECT_MERMAID_CONFIG_ALLOWANCES } from '../scripts/website/reference-parity.mjs'

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

describe('website Reference corpus', () => {
  it('loads the complete human-authored corpus through the validated Task 1 model', async () => {
    const referenceModule = await import('../scripts/website/reference-corpus.mjs') as unknown as {
      loadWebsiteReferenceCorpus?: (options: { artifact: Awaited<ReturnType<typeof exactInstalledArtifact>> }) => Promise<readonly Record<string, unknown>[]>
    }
    expect(referenceModule.loadWebsiteReferenceCorpus).toBeTypeOf('function')

    const records = await referenceModule.loadWebsiteReferenceCorpus!({ artifact: await exactInstalledArtifact() })
    const configuration = records.filter(record => record.kind === 'configuration-group' || record.kind === 'configuration-value')
    expect(records).toHaveLength(43)
    expect(configuration.map(record => record.path)).toEqual(CONFIGURATION_INVENTORY)
    expect(configuration.filter(record => record.kind === 'configuration-group')).toHaveLength(10)
    expect(configuration.filter(record => record.kind === 'configuration-value')).toHaveLength(23)
    expect(records.filter(record => record.kind === 'authoring-input')).toHaveLength(4)
    expect(records.filter(record => record.kind === 'delegated-exception')).toHaveLength(6)
  })

  it('models occurrence aliases without inflating canonical configuration paths', async () => {
    const { loadWebsiteReferenceCorpus } = await import('../scripts/website/reference-corpus.mjs')
    const records = await loadWebsiteReferenceCorpus({ artifact: await exactInstalledArtifact() })
    const enabled = records.find(record => record.path === 'enabled')
    const toolbarTitle = records.find(record => record.path === 'toolbar.title')

    expect(enabled?.occurrences.map(occurrence => occurrence.path)).toEqual([
      'contentMermaid.enabled',
    ])
    expect(toolbarTitle?.occurrences.map(occurrence => occurrence.path)).toEqual([
      'contentMermaid.toolbar.title',
      'runtimeConfig.public.contentMermaid.toolbar.title',
      '<Mermaid>.toolbar.title',
      'Mermaid fence toolbar.title',
      'Mermaid YAML frontmatter toolbar.title',
    ])
    expect(records.filter(record => record.kind.startsWith('configuration-'))).toHaveLength(33)
  })

  it('preserves the exact delegated boundaries, Direct allowances, and deprecated no-op', async () => {
    const { loadWebsiteReferenceCorpus } = await import('../scripts/website/reference-corpus.mjs')
    const records = await loadWebsiteReferenceCorpus({ artifact: await exactInstalledArtifact() })
    const exceptions = records.filter(record => record.kind === 'delegated-exception')

    expect(exceptions.map(record => record.path)).toEqual([
      'delegated.loader-init',
      'delegated.component-page-config',
      'delegated.markdown-page-config',
      'delegated.markdown-diagram-config',
      'delegated.component-direct-config',
      'delegated.markdown-frontmatter-other',
    ])
    expect(exceptions.find(record => record.path === 'delegated.component-direct-config')?.allowances)
      .toEqual(DIRECT_MERMAID_CONFIG_ALLOWANCES)
    expect(records.filter(record => record.deprecation.status === 'deprecated-accepted-no-op').map(record => record.path))
      .toEqual(['theme.useColorModeTheme'])
  })

  it('records exact literal and conditional package transport defaults', async () => {
    const { loadWebsiteReferenceCorpus } = await import('../scripts/website/reference-corpus.mjs')
    const records = await loadWebsiteReferenceCorpus({ artifact: await exactInstalledArtifact() })
    const loaderInit = records.find(record => record.path === 'loader.init')
    const debug = records.find(record => record.path === 'debug')
    if (!loaderInit || !('default' in loaderInit) || !debug || !('default' in debug)) {
      expect.unreachable('default-bearing configuration records must exist')
    }

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
    expect(debug.default).toEqual({ kind: 'literal', value: false, summary: 'Debug mode is off by default.' })
  })

  it('preserves the three explicit negative boundaries', async () => {
    const { loadWebsiteReferenceCorpus } = await import('../scripts/website/reference-corpus.mjs')
    const records = await loadWebsiteReferenceCorpus({ artifact: await exactInstalledArtifact() })

    expect(records.flatMap(record => record.explicitNegatives ?? [])).toEqual([
      'runtimeConfig.public.contentMermaid.enabled is absent and rejected.',
      'mermaidContent is rejected and is not deprecated.',
      'Mermaid %%{init}%% syntax is Mermaid-owned and outside the package inventory.',
    ])
  })
})
