import {
  ContentMermaidConfigurationError,
  assertStrictData,
  cloneOwnedData,
  mergeByPresence,
  type ConfigurationIssueCode,
  type ConfigurationValidationPhase,
} from './core'
import {
  DEFAULT_DARK_THEME,
  DEFAULT_EXPAND_OPTIONS,
  DEFAULT_LIGHT_THEME,
  DEFAULT_MERMAID_CONFIG,
  DEFAULT_TOOLBAR_OPTIONS,
} from '../runtime/constants'
import type { JsonObject, JsonValue, RuntimeMermaidConfig, RuntimeOptions } from '../types/config'

export interface ModuleConfigurationInput {
  readonly nuxtResolvedOptions: unknown
  readonly runtimeOverrides: unknown
}

export interface ResolvedModuleConfiguration {
  readonly enabled: boolean
  readonly runtimeOptions: RuntimeOptions
}

const PACKAGE_RUNTIME_DEFAULTS = {
  loader: {
    init: DEFAULT_MERMAID_CONFIG as RuntimeMermaidConfig,
    lazy: true,
  },
  theme: {
    light: DEFAULT_LIGHT_THEME,
    dark: DEFAULT_DARK_THEME,
  },
  components: {},
  expand: DEFAULT_EXPAND_OPTIONS,
  toolbar: DEFAULT_TOOLBAR_OPTIONS,
} satisfies RuntimeOptions

const PACKAGE_MODULE_DEFAULTS = {
  enabled: true,
  ...PACKAGE_RUNTIME_DEFAULTS,
}

const NUXT_OPTIONS_PHASE = {
  name: 'Nuxt-Resolved Module Options',
  root: 'contentMermaid',
} as const

const RUNTIME_OVERRIDES_PHASE = {
  name: 'Runtime Mermaid Overrides',
  root: 'runtimeConfig.public.contentMermaid',
} as const

const RUNTIME_TRANSPORT_PHASE = {
  name: 'Resolved Runtime Mermaid Options',
  root: 'runtimeConfig.public.contentMermaid',
} as const

const MODULE_OPTION_KEYS = new Set([
  'enabled',
  'debug',
  'loader',
  'theme',
  'components',
  'expand',
  'toolbar',
])

const RUNTIME_OPTION_KEYS = new Set([...MODULE_OPTION_KEYS].filter(key => key !== 'enabled'))

function throwConfigurationIssue(
  phase: ConfigurationValidationPhase,
  path: readonly string[],
  code: ConfigurationIssueCode,
  expected: string,
  received: string,
): never {
  throw new ContentMermaidConfigurationError(phase, [{ path, code, expected, received }], false)
}

function assertPlainObject(
  value: JsonValue,
  phase: ConfigurationValidationPhase,
): asserts value is JsonObject {
  if (value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throwConfigurationIssue(phase, [], 'NON_PLAIN_OBJECT', 'a plain object', 'non-plain-object')
  }
}

function assertKnownKeys(
  value: JsonObject,
  allowedKeys: ReadonlySet<string>,
  phase: ConfigurationValidationPhase,
  path: readonly string[] = [],
): void {
  for (const key of Object.keys(Object.getOwnPropertyDescriptors(value))) {
    if (!allowedKeys.has(key)) {
      throwConfigurationIssue(phase, [...path, key], 'UNEXPECTED_PROPERTY', 'a known configuration property', 'unknown-property')
    }
  }
}

function descriptorValue(value: JsonObject, key: string): JsonValue | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor && 'value' in descriptor ? descriptor.value as JsonValue : undefined
}

function hasOwn(value: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function assertBooleanProperty(
  value: JsonObject,
  key: string,
  phase: ConfigurationValidationPhase,
  path: readonly string[],
): void {
  if (hasOwn(value, key) && typeof descriptorValue(value, key) !== 'boolean') {
    throwConfigurationIssue(phase, [...path, key], 'INVALID_VALUE', 'a boolean', typeof descriptorValue(value, key))
  }
}

function assertStringProperty(
  value: JsonObject,
  key: string,
  phase: ConfigurationValidationPhase,
  path: readonly string[],
): void {
  if (hasOwn(value, key) && typeof descriptorValue(value, key) !== 'string') {
    throwConfigurationIssue(phase, [...path, key], 'INVALID_VALUE', 'a string', typeof descriptorValue(value, key))
  }
}

function assertNumberProperty(
  value: JsonObject,
  key: string,
  phase: ConfigurationValidationPhase,
  path: readonly string[],
): void {
  if (hasOwn(value, key) && typeof descriptorValue(value, key) !== 'number') {
    throwConfigurationIssue(phase, [...path, key], 'INVALID_VALUE', 'a number', typeof descriptorValue(value, key))
  }
}

function assertObjectProperty(
  value: JsonObject,
  key: string,
  phase: ConfigurationValidationPhase,
  path: readonly string[],
  allowedKeys?: ReadonlySet<string>,
): JsonObject | undefined {
  if (!hasOwn(value, key)) return undefined

  const nested = descriptorValue(value, key)
  if (nested === null || Array.isArray(nested) || typeof nested !== 'object') {
    throwConfigurationIssue(phase, [...path, key], 'INVALID_VALUE', 'a plain object', nested === null ? 'null' : typeof nested)
  }
  assertPlainObject(nested, phase)
  if (allowedKeys) assertKnownKeys(nested, allowedKeys, phase, [...path, key])
  return nested
}

function validateRuntimeOptions(value: JsonObject, phase: ConfigurationValidationPhase): void {
  assertKnownKeys(value, RUNTIME_OPTION_KEYS, phase)
  assertBooleanProperty(value, 'debug', phase, [])

  const loader = assertObjectProperty(value, 'loader', phase, [], new Set(['init', 'lazy']))
  if (loader) {
    const init = assertObjectProperty(loader, 'init', phase, ['loader'])
    if (init) {
      assertStringProperty(init, 'theme', phase, ['loader', 'init'])
      assertBooleanProperty(init, 'suppressErrorRendering', phase, ['loader', 'init'])
    }

    if (hasOwn(loader, 'lazy')) {
      const lazy = descriptorValue(loader, 'lazy')
      if (typeof lazy !== 'boolean') {
        if (lazy === null || Array.isArray(lazy) || typeof lazy !== 'object') {
          throwConfigurationIssue(phase, ['loader', 'lazy'], 'INVALID_VALUE', 'a boolean or plain object', lazy === null ? 'null' : typeof lazy)
        }
        assertPlainObject(lazy, phase)
        assertKnownKeys(lazy, new Set(['threshold']), phase, ['loader', 'lazy'])
        assertNumberProperty(lazy, 'threshold', phase, ['loader', 'lazy'])
      }
    }
  }

  const theme = assertObjectProperty(value, 'theme', phase, [], new Set(['useColorModeTheme', 'light', 'dark']))
  if (theme) {
    assertBooleanProperty(theme, 'useColorModeTheme', phase, ['theme'])
    assertStringProperty(theme, 'light', phase, ['theme'])
    assertStringProperty(theme, 'dark', phase, ['theme'])
  }

  const components = assertObjectProperty(value, 'components', phase, [], new Set(['renderer', 'spinner', 'error']))
  if (components) {
    for (const key of ['renderer', 'spinner', 'error']) assertStringProperty(components, key, phase, ['components'])
  }

  if (hasOwn(value, 'expand')) {
    const expand = descriptorValue(value, 'expand')
    if (typeof expand !== 'boolean') {
      if (expand === null || Array.isArray(expand) || typeof expand !== 'object') {
        throwConfigurationIssue(phase, ['expand'], 'INVALID_VALUE', 'a boolean or plain object', expand === null ? 'null' : typeof expand)
      }
      assertPlainObject(expand, phase)
      assertKnownKeys(expand, new Set(['enabled', 'margin', 'invokeOpenOn', 'invokeCloseOn']), phase, ['expand'])
      assertBooleanProperty(expand, 'enabled', phase, ['expand'])
      assertNumberProperty(expand, 'margin', phase, ['expand'])
      const invokeOpenOn = assertObjectProperty(expand, 'invokeOpenOn', phase, ['expand'], new Set(['diagramClick']))
      if (invokeOpenOn) assertBooleanProperty(invokeOpenOn, 'diagramClick', phase, ['expand', 'invokeOpenOn'])
      const invokeCloseOn = assertObjectProperty(expand, 'invokeCloseOn', phase, ['expand'], new Set(['esc', 'wheel', 'swipe', 'overlayClick', 'closeButtonClick']))
      if (invokeCloseOn) {
        for (const key of ['esc', 'wheel', 'swipe', 'overlayClick', 'closeButtonClick']) {
          assertBooleanProperty(invokeCloseOn, key, phase, ['expand', 'invokeCloseOn'])
        }
      }
    }
  }

  const toolbar = assertObjectProperty(value, 'toolbar', phase, [], new Set(['title', 'fontSize', 'fullscreenToolbarScale', 'buttons']))
  if (toolbar) {
    assertStringProperty(toolbar, 'title', phase, ['toolbar'])
    if (hasOwn(toolbar, 'fontSize')) {
      const fontSize = descriptorValue(toolbar, 'fontSize')
      if (typeof fontSize !== 'string' && typeof fontSize !== 'number') {
        throwConfigurationIssue(phase, ['toolbar', 'fontSize'], 'INVALID_VALUE', 'a string or number', typeof fontSize)
      }
    }
    assertNumberProperty(toolbar, 'fullscreenToolbarScale', phase, ['toolbar'])
    const buttons = assertObjectProperty(toolbar, 'buttons', phase, ['toolbar'], new Set(['copy', 'fullscreen', 'expand']))
    if (buttons) {
      for (const key of ['copy', 'fullscreen', 'expand']) assertBooleanProperty(buttons, key, phase, ['toolbar', 'buttons'])
    }
  }
}

function validateModuleOptions(value: JsonObject, phase: ConfigurationValidationPhase): void {
  assertKnownKeys(value, MODULE_OPTION_KEYS, phase)
  assertBooleanProperty(value, 'enabled', phase, [])

  const runtimeOptions = cloneOwnedData(value)
  delete runtimeOptions.enabled
  validateRuntimeOptions(runtimeOptions, phase)
}

function validateRawLayer(value: unknown, phase: ConfigurationValidationPhase, moduleOptions: boolean): JsonObject {
  if (value === undefined) return {}

  assertStrictData(value, phase)
  assertPlainObject(value, phase)
  if (moduleOptions) validateModuleOptions(value, phase)
  else validateRuntimeOptions(value, phase)
  return value
}

function runtimeLayerWithoutActivation(value: JsonObject): JsonObject {
  const result: JsonObject = {}
  for (const key of Object.keys(Object.getOwnPropertyDescriptors(value))) {
    if (key === 'enabled') continue
    const propertyValue = descriptorValue(value, key)
    if (propertyValue !== undefined) result[key] = cloneOwnedData(propertyValue)
  }
  return result
}

function resolveModuleActivation(nuxtResolvedOptions: JsonObject): boolean {
  const enabled = descriptorValue(nuxtResolvedOptions, 'enabled')
  return enabled === undefined ? PACKAGE_MODULE_DEFAULTS.enabled : enabled as boolean
}

function resolveExpandOptions(layers: readonly JsonObject[]): JsonObject {
  let resolved = cloneOwnedData(DEFAULT_EXPAND_OPTIONS) as JsonObject

  for (const layer of layers) {
    if (!hasOwn(layer, 'expand')) continue

    const expand = descriptorValue(layer, 'expand')
    if (typeof expand === 'boolean') {
      resolved = mergeByPresence([DEFAULT_EXPAND_OPTIONS, { enabled: expand }])
      continue
    }

    resolved = mergeByPresence([resolved, expand as JsonObject])
  }

  return resolved
}

function resolveRuntimeTransport(
  nuxtResolvedOptions: JsonObject,
  runtimeOverrides: JsonObject,
): RuntimeOptions {
  const runtimeOptions = mergeByPresence([
    PACKAGE_RUNTIME_DEFAULTS,
    runtimeLayerWithoutActivation(nuxtResolvedOptions),
    runtimeOverrides,
  ])
  runtimeOptions.expand = resolveExpandOptions([nuxtResolvedOptions, runtimeOverrides])

  validateRuntimeOptions(runtimeOptions, RUNTIME_TRANSPORT_PHASE)
  return cloneOwnedData(runtimeOptions) as RuntimeOptions
}

export function resolveModuleConfiguration(
  input: ModuleConfigurationInput,
): ResolvedModuleConfiguration {
  const nuxtResolvedOptions = validateRawLayer(input.nuxtResolvedOptions, NUXT_OPTIONS_PHASE, true)
  const runtimeOverrides = validateRawLayer(input.runtimeOverrides, RUNTIME_OVERRIDES_PHASE, false)

  return {
    enabled: resolveModuleActivation(nuxtResolvedOptions),
    runtimeOptions: resolveRuntimeTransport(nuxtResolvedOptions, runtimeOverrides),
  }
}
