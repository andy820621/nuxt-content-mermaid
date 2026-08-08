import {
  cloneAndDeepFreezeOwnedData,
  mergeByPresence,
  type DeepReadonlyData,
  type ConfigurationValidationPhase,
} from './core'
import {
  resolveExpandOptions,
  resolveToolbarOptions,
  validateRuntimeOptions,
  validateRuntimeOptionsInput,
} from './module'
import type { JsonObject, JsonValue, RuntimeOptions } from '../../types/config'
import { DEFAULT_RUNTIME_OPTIONS } from '../constants'

const RUNTIME_PAYLOAD_PHASE = {
  name: 'Runtime Mermaid Options',
  root: 'runtimeConfig.public.contentMermaid',
} as const

const RUNTIME_SNAPSHOT_PHASE = {
  name: 'Runtime Mermaid Snapshot',
  root: 'runtimeConfig.public.contentMermaid',
} as const

export type ResolvedRuntimeOptions = DeepReadonlyData<RuntimeOptions>

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function descriptorValue(value: JsonObject, key: string): JsonValue | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor && 'value' in descriptor ? descriptor.value as JsonValue : undefined
}

function resolveDebugDefaults(runtimeOptions: JsonObject, rawOptions: JsonObject): void {
  const debug = descriptorValue(runtimeOptions, 'debug') === true
  const loader = descriptorValue(runtimeOptions, 'loader') as JsonObject
  const init = descriptorValue(loader, 'init') as JsonObject
  const rawLoader = descriptorValue(rawOptions, 'loader')
  const rawInit = rawLoader && typeof rawLoader === 'object' && !Array.isArray(rawLoader)
    ? descriptorValue(rawLoader, 'init')
    : undefined
  const explicitInit = rawInit && typeof rawInit === 'object' && !Array.isArray(rawInit)
    ? rawInit
    : undefined

  if (!explicitInit || !hasOwn(explicitInit, 'logLevel')) init.logLevel = debug ? 1 : 5
  if (!explicitInit || !hasOwn(explicitInit, 'suppressErrorRendering')) {
    init.suppressErrorRendering = !debug
  }
}

function resolveRuntimeOptions(
  rawOptions: JsonObject,
  finalPhase: ConfigurationValidationPhase,
): ResolvedRuntimeOptions {
  const runtimeOptions = mergeByPresence([
    DEFAULT_RUNTIME_OPTIONS,
    rawOptions,
  ])

  runtimeOptions.expand = resolveExpandOptions([
    hasOwn(rawOptions, 'expand')
      ? descriptorValue(rawOptions, 'expand') as RuntimeOptions['expand']
      : undefined,
  ]) as unknown as JsonValue
  runtimeOptions.toolbar = resolveToolbarOptions([
    hasOwn(rawOptions, 'toolbar')
      ? descriptorValue(rawOptions, 'toolbar') as RuntimeOptions['toolbar']
      : undefined,
  ]) as unknown as JsonValue
  resolveDebugDefaults(runtimeOptions, rawOptions)
  validateRuntimeOptions(runtimeOptions, finalPhase)

  return cloneAndDeepFreezeOwnedData(runtimeOptions) as ResolvedRuntimeOptions
}

export function resolveRuntimeOptionsSnapshot(payload: unknown): ResolvedRuntimeOptions {
  const rawOptions = validateRuntimeOptionsInput(payload, RUNTIME_PAYLOAD_PHASE)
  return resolveRuntimeOptions(rawOptions, RUNTIME_SNAPSHOT_PHASE)
}
