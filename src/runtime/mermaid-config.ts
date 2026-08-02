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

function materializeStructuralData(
  value: unknown,
  memo: WeakMap<object, unknown>,
): unknown {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function'))
    return value
  if (typeof value === 'function')
    return value

  const existing = memo.get(value)
  if (existing !== undefined)
    return existing

  if (Array.isArray(value)) {
    const clone: unknown[] = []
    memo.set(value, clone)
    for (const item of value)
      clone.push(materializeStructuralData(item, memo))
    return clone
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null)
    return value

  const clone = Object.create(prototype) as Record<PropertyKey, unknown>
  memo.set(value, clone)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable || !('value' in descriptor))
      continue
    Object.defineProperty(clone, key, {
      configurable: true,
      enumerable: true,
      value: materializeStructuralData(descriptor.value, memo),
      writable: true,
    })
  }
  return clone
}

function materializeMermaidConfigWorkingCopy(config: MermaidConfig): MermaidConfig {
  return materializeStructuralData(config, new WeakMap()) as MermaidConfig
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

  return materializeMermaidConfigWorkingCopy({
    startOnLoad: false,
    ...merged,
    theme: theme ?? merged.theme,
  })
}
