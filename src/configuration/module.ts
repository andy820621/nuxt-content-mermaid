import {
  ContentMermaidConfigurationError,
  assertStrictData,
  cloneOwnedData,
  mergeByPresence,
  type ConfigurationIssueCode,
  type ConfigurationValidationPhase,
} from './core'
import {
  DEFAULT_EXPAND_OPTIONS,
  DEFAULT_RUNTIME_OPTIONS,
  DEFAULT_TOOLBAR_OPTIONS,
} from '../runtime/constants'
import type { JsonObject, JsonValue, RuntimeOptions } from '../types/config'
import type { MermaidToolbarOptions } from '../types/mermaid'
import type { ExpandOptions } from '../runtime/types/expand'

export interface ModuleConfigurationInput {
  readonly nuxtResolvedOptions: unknown
  readonly runtimeOverrides: unknown
}

export interface ResolvedModuleConfiguration {
  readonly enabled: boolean
  readonly runtimeOptions: RuntimeOptions
}

const DEFAULT_MODULE_ACTIVATION = true

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
  const prototype = value !== null && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined
  if (value === null || Array.isArray(value) || (prototype !== Object.prototype && prototype !== null)) {
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

export function validateRuntimeOptions(value: JsonObject, phase: ConfigurationValidationPhase): void {
  assertKnownKeys(value, RUNTIME_OPTION_KEYS, phase)
  assertBooleanProperty(value, 'debug', phase, [])

  const loader = assertObjectProperty(value, 'loader', phase, [], new Set(['init', 'lazy']))
  if (loader) {
    const init = assertObjectProperty(loader, 'init', phase, ['loader'])
    if (init) {
      assertStringProperty(init, 'theme', phase, ['loader', 'init'])
      if (hasOwn(init, 'logLevel')) {
        const logLevel = descriptorValue(init, 'logLevel')
        if (typeof logLevel !== 'string' && typeof logLevel !== 'number') {
          throwConfigurationIssue(phase, ['loader', 'init', 'logLevel'], 'INVALID_VALUE', 'a string or number', typeof logLevel)
        }
      }
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

export function validateRuntimeOptionsInput(
  value: unknown,
  phase: ConfigurationValidationPhase,
): JsonObject {
  return validateRawLayer(value, phase, false)
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
  return enabled === undefined ? DEFAULT_MODULE_ACTIVATION : enabled as boolean
}

export function resolveExpandOptions(
  layers: readonly (RuntimeOptions['expand'] | undefined)[],
): ExpandOptions {
  let resolved = cloneOwnedData(DEFAULT_EXPAND_OPTIONS as unknown as JsonObject)

  for (const expand of layers) {
    if (expand === undefined) continue
    if (typeof expand === 'boolean') {
      resolved = mergeByPresence([
        DEFAULT_EXPAND_OPTIONS as unknown as JsonObject,
        { enabled: expand },
      ])
      continue
    }

    resolved = mergeByPresence([resolved, expand as JsonObject])
  }

  return cloneOwnedData(resolved) as unknown as ExpandOptions
}

export function resolveToolbarOptions(
  layers: readonly (RuntimeOptions['toolbar'] | undefined)[],
): MermaidToolbarOptions {
  return mergeByPresence([
    DEFAULT_TOOLBAR_OPTIONS as unknown as JsonObject,
    ...layers.filter((layer): layer is MermaidToolbarOptions => layer !== undefined),
  ]) as unknown as MermaidToolbarOptions
}

function resolveRuntimeTransport(
  nuxtResolvedOptions: JsonObject,
  runtimeOverrides: JsonObject,
): RuntimeOptions {
  const runtimeOptions = mergeByPresence([
    DEFAULT_RUNTIME_OPTIONS,
    runtimeLayerWithoutActivation(nuxtResolvedOptions),
    runtimeOverrides,
  ])
  runtimeOptions.expand = resolveExpandOptions([
    hasOwn(nuxtResolvedOptions, 'expand')
      ? descriptorValue(nuxtResolvedOptions, 'expand') as RuntimeOptions['expand']
      : undefined,
    hasOwn(runtimeOverrides, 'expand')
      ? descriptorValue(runtimeOverrides, 'expand') as RuntimeOptions['expand']
      : undefined,
  ]) as unknown as JsonValue
  runtimeOptions.toolbar = resolveToolbarOptions([
    hasOwn(nuxtResolvedOptions, 'toolbar')
      ? descriptorValue(nuxtResolvedOptions, 'toolbar') as RuntimeOptions['toolbar']
      : undefined,
    hasOwn(runtimeOverrides, 'toolbar')
      ? descriptorValue(runtimeOverrides, 'toolbar') as RuntimeOptions['toolbar']
      : undefined,
  ]) as unknown as JsonValue

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
