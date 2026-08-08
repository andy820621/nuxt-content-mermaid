import type { MermaidConfig } from 'mermaid'
import { mergeByPresence } from './configuration/core'
import type { JsonObject } from '../types/config'
import type { MermaidComponentSource } from './component-configuration'
import { mergeDirectMermaidConfigForInvocation } from './direct-mermaid-config'
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

type LegalMermaidComponentSource = Exclude<MermaidComponentSource, { readonly kind: 'conflict' }>

interface InvocationConfigOptions {
  runtimeConfig?: MermaidConfig
  source: LegalMermaidComponentSource
  theme?: MermaidConfig['theme']
}

export function materializeMermaidConfigForInvocation(
  options: InvocationConfigOptions,
): MermaidConfig {
  const runtimeWorkingCopy = mergeByPresence([
    { startOnLoad: false },
    (options.runtimeConfig ?? {}) as JsonObject,
  ]) as MermaidConfig

  let sourceWorkingCopy: MermaidConfig
  if (options.source.kind === 'direct') {
    sourceWorkingCopy = mergeDirectMermaidConfigForInvocation(
      runtimeWorkingCopy,
      options.source.config,
    )
  }
  else if (options.source.kind === 'page') {
    sourceWorkingCopy = mergeByPresence([
      runtimeWorkingCopy as JsonObject,
      options.source.config,
    ]) as MermaidConfig
  }
  else {
    sourceWorkingCopy = runtimeWorkingCopy
  }

  if (options.theme !== undefined) {
    Object.defineProperty(sourceWorkingCopy, 'theme', {
      configurable: true,
      enumerable: true,
      value: options.theme,
      writable: true,
    })
  }

  return sourceWorkingCopy
}
