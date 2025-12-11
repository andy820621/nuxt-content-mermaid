import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMermaidTheme } from '../src/runtime/composables/useMermaidTheme'
import { resolveMermaidTheme } from '../src/runtime/mermaid-config'

// Mock useState
vi.mock('#app', () => ({
  useState: vi.fn((key, init) => {
    const state = { value: init() }
    return state
  }),
}))

describe('useMermaidTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with null theme', () => {
    const { currentTheme } = useMermaidTheme()
    expect(currentTheme.value).toBe(null)
  })

  it('should set theme to dark', () => {
    const { setMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('dark')
    expect(currentTheme.value).toBe('dark')
  })

  it('should set theme to light', () => {
    const { setMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('light')
    expect(currentTheme.value).toBe('light')
  })

  it('should reset theme to null', () => {
    const { setMermaidTheme, resetMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('dark')
    expect(currentTheme.value).toBe('dark')

    resetMermaidTheme()
    expect(currentTheme.value).toBe(null)
  })

  it('should handle full Mermaid theme name "default"', () => {
    const { setMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('default')
    expect(currentTheme.value).toBe('default')
  })

  it('should handle full Mermaid theme name "forest"', () => {
    const { setMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('forest')
    expect(currentTheme.value).toBe('forest')
  })

  it('should handle full Mermaid theme name "neutral"', () => {
    const { setMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('neutral')
    expect(currentTheme.value).toBe('neutral')
  })

  it('should handle full Mermaid theme name "base"', () => {
    const { setMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('base')
    expect(currentTheme.value).toBe('base')
  })

  it('should handle null mode', () => {
    const { setMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('dark')
    setMermaidTheme(null)
    expect(currentTheme.value).toBe(null)
  })

  it('should handle getMermaidTheme()', () => {
    const { setMermaidTheme, getMermaidTheme } = useMermaidTheme()
    setMermaidTheme('dark')
    expect(getMermaidTheme()).toBe('dark')

    setMermaidTheme('forest')
    expect(getMermaidTheme()).toBe('forest')

    setMermaidTheme(null)
    expect(getMermaidTheme()).toBe(null)
  })

  it('should handle resetMermaidTheme()', () => {
    const { setMermaidTheme, resetMermaidTheme, currentTheme } = useMermaidTheme()
    setMermaidTheme('forest')
    expect(currentTheme.value).toBe('forest')

    resetMermaidTheme()
    expect(currentTheme.value).toBe(null)
  })
})

describe('resolveMermaidTheme with Strict Semantic Resolution', () => {
  it('should prioritize frontmatter theme over all others', () => {
    const result = resolveMermaidTheme({
      frontmatterTheme: 'forest',
      manualThemeMode: 'dark',
      colorModeValue: 'light',
      lightTheme: 'default',
      darkTheme: 'dark',
    })
    expect(result).toBe('forest')
  })

  it('should apply strict semantic resolution for reserved keyword "dark"', () => {
    // dark strategy with configured darkTheme
    expect(
      resolveMermaidTheme({
        manualThemeMode: 'dark',
        colorModeValue: 'light',
        lightTheme: 'default',
        darkTheme: 'dark',
      }),
    ).toBe('dark')

    // dark strategy with undefined darkTheme → fallback to Mermaid's 'dark'
    expect(
      resolveMermaidTheme({
        manualThemeMode: 'dark',
        lightTheme: 'default',
        darkTheme: undefined,
      }),
    ).toBe('dark')
  })

  it('should apply strict semantic resolution for reserved keyword "light"', () => {
    // light strategy with configured lightTheme
    expect(
      resolveMermaidTheme({
        manualThemeMode: 'light',
        colorModeValue: 'dark',
        lightTheme: 'default',
        darkTheme: 'dark',
      }),
    ).toBe('default')

    // light strategy with undefined lightTheme → fallback to Mermaid's 'default'
    expect(
      resolveMermaidTheme({
        manualThemeMode: 'light',
        darkTheme: 'dark',
        lightTheme: undefined,
      }),
    ).toBe('default')
  })

  it('should pass through direct theme names without modification', () => {
    // Direct theme name 'forest': pass through unchanged
    const resultForest = resolveMermaidTheme({
      manualThemeMode: 'forest',
      lightTheme: 'default',
      darkTheme: 'dark',
    })
    expect(resultForest).toBe('forest')

    // Direct theme name 'forest' even with undefined darkTheme
    const resultForestUndefined = resolveMermaidTheme({
      manualThemeMode: 'forest',
      lightTheme: 'default',
      darkTheme: undefined,
    })
    expect(resultForestUndefined).toBe('forest')

    // Direct theme name 'neutral' with undefined lightTheme
    const resultNeutral = resolveMermaidTheme({
      manualThemeMode: 'neutral',
      darkTheme: 'dark',
      lightTheme: undefined,
    })
    expect(resultNeutral).toBe('neutral')
  })

  it('should apply strict semantic resolution for colorMode', () => {
    // colorMode 'dark' with configured darkTheme
    expect(
      resolveMermaidTheme({
        colorModeValue: 'dark',
        darkTheme: 'dark',
        lightTheme: 'default',
      }),
    ).toBe('dark')

    // colorMode 'dark' with undefined darkTheme → fallback to Mermaid's 'dark'
    expect(
      resolveMermaidTheme({
        colorModeValue: 'dark',
        darkTheme: undefined,
        lightTheme: 'default',
      }),
    ).toBe('dark')

    // colorMode 'light' with configured lightTheme
    expect(
      resolveMermaidTheme({
        colorModeValue: 'light',
        darkTheme: 'dark',
        lightTheme: 'default',
      }),
    ).toBe('default')

    // colorMode 'light' with undefined lightTheme → fallback to Mermaid's 'default'
    expect(
      resolveMermaidTheme({
        colorModeValue: 'light',
        darkTheme: 'dark',
        lightTheme: undefined,
      }),
    ).toBe('default')
  })

  it('should prioritize manual mode over colorMode', () => {
    const result = resolveMermaidTheme({
      manualThemeMode: null,
      colorModeValue: 'dark',
      lightTheme: 'default',
      darkTheme: 'dark',
    })
    expect(result).toBe('dark')
  })

  it('should fall back to base/light/dark theme when no mode is set', () => {
    // With baseTheme
    expect(
      resolveMermaidTheme({
        baseTheme: 'neutral',
        lightTheme: 'default',
        darkTheme: 'dark',
      }),
    ).toBe('neutral')

    // Without baseTheme, fallback to lightTheme
    expect(
      resolveMermaidTheme({
        lightTheme: 'default',
        darkTheme: 'dark',
      }),
    ).toBe('default')
  })
})
