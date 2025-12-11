import { describe, it, expect } from 'vitest'
import type { MermaidConfig } from 'mermaid'
import { mergeMermaidConfig, resolveMermaidTheme } from '../src/runtime/mermaid-config'

describe('mermaid config helpers', () => {
  it('deep merges base and override configs', () => {
    const baseConfig: MermaidConfig = {
      theme: 'neutral',
      flowchart: {
        htmlLabels: true,
        curve: 'basis',
      },
    }
    const overrideConfig: MermaidConfig = {
      flowchart: {
        htmlLabels: false,
      },
    }

    const result = mergeMermaidConfig({
      baseConfig,
      overrideConfig,
      theme: 'forest',
    })

    expect(result.flowchart?.htmlLabels).toBe(false)
    expect(result.flowchart?.curve).toBe('basis')
    expect(result.theme).toBe('forest')
    expect(result.startOnLoad).toBe(false)
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
