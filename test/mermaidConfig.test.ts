import { describe, it, expect } from 'vitest'
import type { MermaidConfig } from 'mermaid'
import type { PageMermaidConfig } from '../src/types/config'
import {
  materializeMermaidConfigForInvocation,
  resolveMermaidTheme,
} from '../src/runtime/mermaid-config'

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
