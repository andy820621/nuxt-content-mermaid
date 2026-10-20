import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { MermaidConfig } from 'mermaid'
import type { PageMermaidConfig } from '../src/types/config'
import {
  materializeMermaidConfigForInvocation,
  resolveMermaidTheme,
} from '../src/runtime/mermaid-config'

describe('removed defaultRenderer development warnings', () => {
  let server: ViteDevServer
  let materialize: typeof materializeMermaidConfigForInvocation
  let moduleId = 0

  beforeAll(async () => {
    server = await createServer({
      configFile: false,
      define: { 'import.meta.dev': 'true' },
      server: { middlewareMode: true, watch: null, hmr: false },
      appType: 'custom',
    })
  })

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // A fresh dev module gives each case a new page-level warning Set.
    const helpers = await server.ssrLoadModule(`/src/runtime/mermaid-config.ts?warning-case=${++moduleId}`)
    materialize = helpers.materializeMermaidConfigForInvocation
  })

  afterEach(() => vi.restoreAllMocks())
  afterAll(async () => server?.close())

  const cases = (['Page Mermaid Config', 'Direct Mermaid Config', 'loader.init'] as const).flatMap(source =>
    (['flowchart', 'class', 'state'] as const).flatMap(diagram =>
      (['dagre-wrapper', 'elk'] as const).map(value => ({ source, diagram, value })),
    ),
  )

  it.each(cases)('warns once per page for $source.$diagram.defaultRenderer = $value', ({ source, diagram, value }) => {
    const config = Object.freeze({ [diagram]: Object.freeze({ defaultRenderer: value }) }) as unknown as MermaidConfig
    const options: Parameters<typeof materialize>[0] = source === 'loader.init'
      ? { runtimeConfig: config, source: { kind: 'runtime-only' } }
      : source === 'Page Mermaid Config'
        ? { source: { kind: 'page', config: config as PageMermaidConfig } }
        : { source: { kind: 'direct', config } }

    for (const theme of ['default', 'dark', 'forest'] as const) {
      const result = materialize({ ...options, theme })
      expect(result).toMatchObject({ [diagram]: { defaultRenderer: value }, theme })
      expect(result).not.toBe(config)
    }

    expect(console.warn).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(`${source}.${diagram}.defaultRenderer`))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('layout: \'dagre\''))
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('layout: \'elk\''))
    expect(config).toEqual({ [diagram]: { defaultRenderer: value } })
  })

  it('deduplicates the same legacy field across multiple diagrams on one page', () => {
    for (const value of ['dagre-wrapper', 'elk']) {
      materialize({
        runtimeConfig: { flowchart: { defaultRenderer: value } } as unknown as MermaidConfig,
        source: { kind: 'runtime-only' },
      })
    }
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('warns separately for each source and field', () => {
    const config = {
      flowchart: { defaultRenderer: 'elk' },
      class: { defaultRenderer: 'elk' },
      state: { defaultRenderer: 'elk' },
    } as unknown as MermaidConfig

    materialize({ runtimeConfig: config, source: { kind: 'page', config: config as PageMermaidConfig } })
    materialize({ runtimeConfig: config, source: { kind: 'direct', config } })
    expect(console.warn).toHaveBeenCalledTimes(9)
  })

  it('warns about a legacy field even when top-level layout is already present', () => {
    materialize({
      source: { kind: 'direct', config: { layout: 'dagre', state: { defaultRenderer: 'elk' } } as unknown as MermaidConfig },
    })
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('does not warn without legacy fields', () => {
    materialize({ source: { kind: 'runtime-only' } })
    materialize({
      runtimeConfig: { layout: 'dagre' },
      source: { kind: 'page', config: { layout: 'elk', flowchart: { htmlLabels: false } } },
    })
    expect(console.warn).not.toHaveBeenCalled()
  })
})

describe('mermaid config helpers', () => {
  it('deep merges base and override configs', () => {
    const baseConfig: MermaidConfig = {
      theme: 'neutral',
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
      },
    }
    const overrideConfig: PageMermaidConfig = {
      flowchart: {
        htmlLabels: false,
      },
    }

    const result = materializeMermaidConfigForInvocation({
      runtimeConfig: baseConfig,
      source: { kind: 'page', config: overrideConfig },
      theme: 'forest',
    })

    expect(result.flowchart?.htmlLabels).toBe(false)
    expect(result.flowchart?.curve).toBe('basis')
    expect(result.theme).toBe('forest')
    expect(result.startOnLoad).toBe(false)
  })

  it('materializes detached nested structural data for every invocation', () => {
    const baseConfig = Object.freeze({
      flowchart: Object.freeze({
        htmlLabels: true,
        curve: 'basis',
      }),
      secure: Object.freeze(['securityLevel']),
    }) as unknown as MermaidConfig

    const first = materializeMermaidConfigForInvocation({
      runtimeConfig: baseConfig,
      source: { kind: 'runtime-only' },
    })
    const second = materializeMermaidConfigForInvocation({
      runtimeConfig: baseConfig,
      source: { kind: 'runtime-only' },
    })

    expect(first.flowchart).not.toBe(baseConfig.flowchart)
    expect(first.flowchart).not.toBe(second.flowchart)
    expect(first.secure).not.toBe(baseConfig.secure)
    expect(first.secure).not.toBe(second.secure)

    first.flowchart!.htmlLabels = false
    first.secure!.push('theme')

    expect(baseConfig.flowchart?.htmlLabels).toBe(true)
    expect(baseConfig.secure).toEqual(['securityLevel'])
    expect(second.flowchart?.htmlLabels).toBe(true)
    expect(second.secure).toEqual(['securityLevel'])
  })

  it('resolves Runtime and Direct Mermaid Config with direct-specific invocation isolation', () => {
    const fontCallback = () => ({ fontSize: 16 })
    const shared = { values: ['input'] }
    const runtimeConfig = {
      startOnLoad: false,
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
      },
      runtimeExtension: { enabled: true },
    } as unknown as MermaidConfig
    const directConfig = {
      startOnLoad: true,
      flowchart: { htmlLabels: false },
      sequence: { actorFont: fontCallback },
      directExtension: { first: shared, second: shared },
    } as unknown as MermaidConfig

    const first = materializeMermaidConfigForInvocation({
      runtimeConfig,
      source: { kind: 'direct', config: directConfig },
      theme: 'forest',
    }) as MermaidConfig & {
      runtimeExtension: { enabled: boolean }
      directExtension: { first: typeof shared, second: typeof shared }
    }
    const second = materializeMermaidConfigForInvocation({
      runtimeConfig,
      source: { kind: 'direct', config: directConfig },
      theme: 'forest',
    }) as typeof first

    expect(first).toMatchObject({
      startOnLoad: true,
      theme: 'forest',
      flowchart: {
        htmlLabels: false,
        curve: 'basis',
      },
      runtimeExtension: { enabled: true },
    })
    expect(first.sequence?.actorFont).toBe(fontCallback)
    expect(first.directExtension.first).toBe(first.directExtension.second)
    expect(first.directExtension.first).not.toBe(shared)
    expect(first.directExtension.first).not.toBe(second.directExtension.first)

    first.directExtension.first.values.push('first invocation')

    expect(shared.values).toEqual(['input'])
    expect(second.directExtension.first.values).toEqual(['input'])
    expect(runtimeConfig.flowchart?.htmlLabels).toBe(true)
  })

  it('retains opaque Direct capability identity when Runtime has the same object path', () => {
    const trustedTypesPolicy = { createHTML: (value: string) => value }
    const result = materializeMermaidConfigForInvocation({
      runtimeConfig: {
        dompurifyConfig: {
          TRUSTED_TYPES_POLICY: { createHTML: (value: string) => value },
        },
      } as unknown as MermaidConfig,
      source: {
        kind: 'direct',
        config: {
          dompurifyConfig: { TRUSTED_TYPES_POLICY: trustedTypesPolicy },
        } as unknown as MermaidConfig,
      },
    })

    expect(result.dompurifyConfig?.TRUSTED_TYPES_POLICY).toBe(trustedTypesPolicy)
  })

  it('preserves shared Direct objects when one path collides with Runtime config', () => {
    const shared = { direct: true }
    const result = materializeMermaidConfigForInvocation({
      runtimeConfig: {
        extension: { first: { runtime: true } },
      } as unknown as MermaidConfig,
      source: {
        kind: 'direct',
        config: {
          extension: { second: shared, first: shared },
        } as unknown as MermaidConfig,
      },
    }) as MermaidConfig & {
      extension: {
        first: { direct: boolean, runtime: boolean }
        second: { direct: boolean, runtime: boolean }
      }
    }

    expect(result.extension.first).toBe(result.extension.second)
    expect(result.extension.first).not.toBe(shared)
    expect(result.extension.first).toEqual({ runtime: true, direct: true })
  })

  it('selects theme with correct priority', () => {
    expect(
      resolveMermaidTheme({
        frontmatterTheme: 'forest',
        colorModeValue: 'dark',
        lightTheme: 'neutral',
        darkTheme: 'dark',
        baseTheme: 'base',
      }),
    ).toBe('forest')

    expect(
      resolveMermaidTheme({
        colorModeValue: 'dark',
        darkTheme: 'dark',
        lightTheme: 'default',
        baseTheme: 'base',
      }),
    ).toBe('dark')

    expect(
      resolveMermaidTheme({
        colorModeValue: 'light',
        lightTheme: 'default',
        darkTheme: 'dark',
        baseTheme: 'base',
      }),
    ).toBe('default')

    expect(
      resolveMermaidTheme({
        baseTheme: 'base',
        lightTheme: 'default',
        darkTheme: 'dark',
      }),
    ).toBe('base')
  })

  it('applies strict semantic resolution for reserved keywords', () => {
    // 'dark' strategy: always dark, fallback to Mermaid's 'dark'
    expect(
      resolveMermaidTheme({
        manualThemeMode: 'dark',
        darkTheme: undefined,
        lightTheme: 'default',
      }),
    ).toBe('dark')

    // 'light' strategy: always light, fallback to Mermaid's 'default'
    expect(
      resolveMermaidTheme({
        manualThemeMode: 'light',
        darkTheme: 'dark',
        lightTheme: undefined,
      }),
    ).toBe('default')

    // Direct theme name: pass through
    expect(
      resolveMermaidTheme({
        manualThemeMode: 'forest',
        lightTheme: 'default',
        darkTheme: 'dark',
      }),
    ).toBe('forest')
  })

  it('applies strict semantic resolution for colorMode', () => {
    // colorMode 'dark': fallback to Mermaid's 'dark' if no darkTheme
    expect(
      resolveMermaidTheme({
        colorModeValue: 'dark',
        darkTheme: undefined,
        lightTheme: 'default',
      }),
    ).toBe('dark')

    // colorMode light: fallback to Mermaid's 'default' if no lightTheme
    expect(
      resolveMermaidTheme({
        colorModeValue: 'light',
        darkTheme: 'dark',
        lightTheme: undefined,
      }),
    ).toBe('default')
  })
})
