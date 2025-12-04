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
        useColorModeTheme: true,
        colorModeValue: 'dark',
        lightTheme: 'neutral',
        darkTheme: 'dark',
        baseTheme: 'base',
      }),
    ).toBe('forest')

    expect(
      resolveMermaidTheme({
        useColorModeTheme: true,
        colorModeValue: 'dark',
        darkTheme: 'dark',
        lightTheme: 'default',
        baseTheme: 'base',
      }),
    ).toBe('dark')

    expect(
      resolveMermaidTheme({
        useColorModeTheme: false,
        baseTheme: 'base',
        lightTheme: 'default',
        darkTheme: 'dark',
      }),
    ).toBe('base')
  })
})
