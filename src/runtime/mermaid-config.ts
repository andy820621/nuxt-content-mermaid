import { defu } from 'defu'
import type { MermaidConfig } from 'mermaid'
import type { MermaidThemeMode } from './composables/useMermaidTheme'

interface ThemeOptions {
  colorModeValue?: string
  manualThemeMode?: MermaidThemeMode
  baseTheme?: MermaidConfig['theme']
  lightTheme?: MermaidConfig['theme']
  darkTheme?: MermaidConfig['theme']
  frontmatterTheme?: MermaidConfig['theme']
}

export function resolveMermaidTheme(options: ThemeOptions) {
  const {
    colorModeValue,
    manualThemeMode,
    frontmatterTheme,
    baseTheme,
    lightTheme,
    darkTheme,
  } = options

  // Priority: frontmatter > manual mode > colorMode > base
  if (frontmatterTheme) return frontmatterTheme

  // Strict Semantic Resolution: 'dark' and 'light' are reserved strategy keywords （They represent a strategy, not just a value name）
  if (manualThemeMode) {
    if (manualThemeMode === 'dark') return darkTheme ?? 'dark'
    if (manualThemeMode === 'light') return lightTheme ?? 'default'

    return manualThemeMode
  }

  // Fallback to colorMode integration when available
  if (colorModeValue) {
    if (colorModeValue === 'dark') {
      return darkTheme ?? 'dark'
    }
    else {
      return lightTheme ?? 'default'
    }
  }

  return baseTheme ?? lightTheme ?? 'default'
}

interface MergeOptions extends MermaidConfig {
  baseConfig?: MermaidConfig
  overrideConfig?: MermaidConfig
  theme?: MermaidConfig['theme']
}

export function mergeMermaidConfig(options: MergeOptions): MermaidConfig {
  const {
    baseConfig,
    overrideConfig,
    theme,
    ...overrides
  } = options

  const merged = defu(
    {},
    overrides || {},
    overrideConfig || {},
    baseConfig || {},
  ) as MermaidConfig

  return {
    startOnLoad: false,
    ...merged,
    theme: theme ?? merged.theme,
  }
}
