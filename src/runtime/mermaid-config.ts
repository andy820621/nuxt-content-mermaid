import type { MermaidConfig } from 'mermaid'
import { mergeByPresence } from './configuration/core'
import type { JsonObject } from '../types/config'
import type { MermaidComponentSource } from './component-configuration'
import { mergeDirectMermaidConfigForInvocation } from './direct-mermaid-config'
import type { MermaidThemeMode } from './composables/useMermaidTheme'
import { MERMAID_LOG_PREFIX } from './constants'

const defaultRendererWarnings = import.meta.dev ? new Set<string>() : undefined

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

  if (import.meta.dev && defaultRendererWarnings) {
    const sources = [
      ['loader.init', options.runtimeConfig],
      [options.source.kind === 'page' ? 'Page Mermaid Config' : 'Direct Mermaid Config',
        options.source.kind === 'runtime-only' ? undefined : options.source.config],
    ] as const

    for (const [source, config] of sources) {
      for (const diagram of ['flowchart', 'class', 'state'] as const) {
        const diagramConfig = config?.[diagram]
        const key = `${source}.${diagram}.defaultRenderer`
        if (!diagramConfig || !Object.hasOwn(diagramConfig, 'defaultRenderer') || defaultRendererWarnings.has(key)) continue

        defaultRendererWarnings.add(key)
        console.warn(`${MERMAID_LOG_PREFIX} ${key} is ignored by Mermaid 12. Use top-level layout: 'dagre' (previously 'dagre-wrapper') or layout: 'elk' instead.`)
      }
    }
  }

  return sourceWorkingCopy
}
