import { defu } from 'defu'
import type { MermaidConfig } from 'mermaid'

interface ThemeOptions {
  useColorModeTheme?: boolean
  colorModeValue?: string
  baseTheme?: MermaidConfig['theme']
  lightTheme?: MermaidConfig['theme']
  darkTheme?: MermaidConfig['theme']
  frontmatterTheme?: MermaidConfig['theme']
}

export function resolveMermaidTheme(options: ThemeOptions) {
  const {
    useColorModeTheme,
    colorModeValue,
    frontmatterTheme,
    baseTheme,
    lightTheme,
    darkTheme,
  } = options

  if (frontmatterTheme) return frontmatterTheme

  if (useColorModeTheme && colorModeValue) {
    if (colorModeValue === 'dark' && darkTheme) return darkTheme
    if (colorModeValue !== 'dark' && lightTheme) return lightTheme
  }

  return baseTheme ?? lightTheme ?? darkTheme
}

interface MergeOptions {
  baseConfig?: MermaidConfig
  overrideConfig?: MermaidConfig
  theme?: MermaidConfig['theme']
}

export function mergeMermaidConfig(options: MergeOptions): MermaidConfig {
  const { baseConfig, overrideConfig, theme } = options
  const merged = defu(
    {},
    overrideConfig || {},
    baseConfig || {},
  ) as MermaidConfig

  return {
    startOnLoad: false,
    ...merged,
    theme: theme ?? merged.theme,
  }
}
