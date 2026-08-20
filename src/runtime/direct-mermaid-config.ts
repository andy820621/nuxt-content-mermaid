import type { MermaidConfig } from 'mermaid'
import { createMermaidComponentConfigurationError } from './component-configuration-error'
import {
  DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS,
  MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS,
  MERMAID_11_16_1_REGEXP_PATHS,
} from './constants'

type ConfigPath = readonly (string | number)[]
type SupportedConfigPath = readonly string[]

function formatConfigPath(path: readonly (string | number)[]): string {
  return path.reduce<string>(
    (result, segment) => typeof segment === 'number'
      ? `${result}[${segment}]`
      : `${result}.${segment}`,
    'config',
  )
}

function invalidDirectConfig(path: readonly (string | number)[], expected: string): never {
  throw createMermaidComponentConfigurationError(
    `Direct Mermaid Config at ${formatConfigPath(path)} must be ${expected}.`,
  )
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isArrayIndexKey(key: string): boolean {
  if (key === '') return false
  const index = Number(key)
  return Number.isInteger(index)
    && index >= 0
    && index < 0xFFFFFFFF
    && String(index) === key
}

function matchesSupportedPath(
  path: ConfigPath,
  supportedPaths: readonly SupportedConfigPath[],
): boolean {
  return supportedPaths.some(supportedPath => supportedPath.length === path.length
    && supportedPath.every((segment, index) => path[index] === segment))
}

function isFunctionCapability(value: unknown, path: ConfigPath): boolean {
  return typeof value === 'function'
    && matchesSupportedPath(path, MERMAID_11_16_1_FUNCTION_CAPABILITY_PATHS)
}

function isOpaqueObjectCapability(value: unknown, path: ConfigPath): value is object {
  return value !== null
    && typeof value === 'object'
    && matchesSupportedPath(path, DOMPURIFY_3_4_13_OPAQUE_CAPABILITY_PATHS)
}

function validateDirectValue(
  value: unknown,
  path: readonly (string | number)[],
  ancestors: Set<object>,
): void {
  if (isFunctionCapability(value, path) || isOpaqueObjectCapability(value, path))
    return

  if (typeof value === 'function')
    invalidDirectConfig(path, 'a supported capability at its exact Mermaid 11.17.0 or DOMPurify 3.4.13 path')
  if (typeof value === 'symbol' || typeof value === 'bigint')
    invalidDirectConfig(path, 'structural data')
  if (value === null || typeof value !== 'object') return

  if (value instanceof RegExp) {
    if (!matchesSupportedPath(path, MERMAID_11_16_1_REGEXP_PATHS))
      invalidDirectConfig(path, 'a RegExp at an exact DOMPurify 3.4.13 RegExp path')
    if (Reflect.ownKeys(value).some(key => key !== 'lastIndex'))
      invalidDirectConfig(path, 'a RegExp without custom properties')
    return
  }

  if (!Array.isArray(value) && !isPlainObject(value))
    invalidDirectConfig(path, 'a plain object, array, or supported opaque capability')
  if (ancestors.has(value))
    invalidDirectConfig(path, 'acyclic structural data')

  ancestors.add(value)
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value)
    if (Reflect.ownKeys(descriptors).some(key => typeof key === 'symbol'))
      invalidDirectConfig(path, 'string-keyed structural data')

    if (Array.isArray(value)) {
      const extraKeys = Object.keys(descriptors)
        .filter(key => key !== 'length' && !isArrayIndexKey(key))
      if (extraKeys.length > 0)
        invalidDirectConfig([...path, extraKeys[0]!], 'an array without custom properties')

      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)]
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
          invalidDirectConfig([...path, index], 'an enumerable array data property')
        validateDirectValue(descriptor.value, [...path, index], ancestors)
      }
      return
    }

    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key]
      if (!descriptor?.enumerable || !('value' in descriptor))
        invalidDirectConfig([...path, key], 'an enumerable data property')
      validateDirectValue(descriptor.value, [...path, key], ancestors)
    }
  }
  finally {
    ancestors.delete(value)
  }
}

function cloneDirectValue(
  value: unknown,
  path: readonly (string | number)[],
  memo: WeakMap<object, unknown>,
): unknown {
  if (isFunctionCapability(value, path) || isOpaqueObjectCapability(value, path))
    return value
  if (value === null || typeof value !== 'object') return value

  const existing = memo.get(value)
  if (existing !== undefined) return existing

  if (value instanceof RegExp) {
    const copy = new RegExp(value.source, value.flags)
    copy.lastIndex = value.lastIndex
    memo.set(value, copy)
    return copy
  }

  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Array.isArray(value)) {
    const copy: unknown[] = []
    memo.set(value, copy)
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)]!
      copy.push(cloneDirectValue(descriptor.value, [...path, index], memo))
    }
    return copy
  }

  const copy: Record<PropertyKey, unknown> = Object.create(Object.getPrototypeOf(value))
  memo.set(value, copy)
  for (const key of Object.keys(descriptors)) {
    const descriptor = descriptors[key]!
    Object.defineProperty(copy, key, {
      configurable: true,
      enumerable: true,
      value: cloneDirectValue(descriptor.value, [...path, key], memo),
      writable: true,
    })
  }
  return copy
}

export function assertDirectMermaidConfig(config: unknown): asserts config is MermaidConfig {
  if (config === null || typeof config !== 'object' || Array.isArray(config) || !isPlainObject(config))
    invalidDirectConfig([], 'a plain object')

  validateDirectValue(config, [], new Set())
}

export function materializeDirectMermaidConfigForInvocation(
  config: MermaidConfig,
): MermaidConfig {
  assertDirectMermaidConfig(config)
  return cloneDirectValue(config, [], new WeakMap()) as MermaidConfig
}

function defineOwnedProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

function mergeDirectObjectByPresence(
  lower: Record<string, unknown>,
  higher: Record<string, unknown>,
  memo: WeakMap<object, Record<string, unknown>>,
  path: ConfigPath,
): Record<string, unknown> {
  let result = memo.get(higher)
  if (!result) {
    result = Object.create(Object.getPrototypeOf(higher)) as Record<string, unknown>
    memo.set(higher, result)
  }

  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(lower))) {
    if ('value' in descriptor && !Object.hasOwn(result, key))
      defineOwnedProperty(result, key, descriptor.value)
  }

  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(higher))) {
    const higherValue = descriptor.value
    const lowerDescriptor = Object.getOwnPropertyDescriptor(lower, key)
    const lowerValue = lowerDescriptor && 'value' in lowerDescriptor
      ? lowerDescriptor.value
      : undefined
    const nestedPath = [...path, key]
    const shouldMerge = !isOpaqueObjectCapability(higherValue, nestedPath)
      && higherValue !== null
      && typeof higherValue === 'object'
      && !Array.isArray(higherValue)
      && isPlainObject(higherValue)
    let mergedValue = higherValue
    if (shouldMerge) {
      const mergeBase = lowerDescriptor
        && lowerValue !== null
        && typeof lowerValue === 'object'
        && !Array.isArray(lowerValue)
        && isPlainObject(lowerValue)
        ? lowerValue as Record<string, unknown>
        : Object.create(Object.getPrototypeOf(higherValue)) as Record<string, unknown>
      mergedValue = mergeDirectObjectByPresence(
        mergeBase,
        higherValue as Record<string, unknown>,
        memo,
        nestedPath,
      )
    }

    defineOwnedProperty(result, key, mergedValue)
  }

  return result
}

export function mergeDirectMermaidConfigForInvocation(
  runtimeConfig: MermaidConfig,
  directConfig: MermaidConfig,
): MermaidConfig {
  const directWorkingCopy = materializeDirectMermaidConfigForInvocation(directConfig)
  return mergeDirectObjectByPresence(
    runtimeConfig as Record<string, unknown>,
    directWorkingCopy as Record<string, unknown>,
    new WeakMap(),
    [],
  ) as MermaidConfig
}

// Vue's deep watch would traverse provider-owned capabilities. This descriptor-aware
// walk tracks structural changes while stopping at approved identity-only values.
function collectDirectDependencies(
  value: unknown,
  path: readonly (string | number)[],
  ancestors: Set<object>,
  dependencies: unknown[],
): void {
  dependencies.push(value)
  if (isFunctionCapability(value, path) || isOpaqueObjectCapability(value, path))
    return
  if (value === null || typeof value !== 'object' || value instanceof RegExp)
    return

  let isStructural = Array.isArray(value)
  try {
    isStructural ||= isPlainObject(value)
  }
  catch {
    return
  }
  if (!isStructural || ancestors.has(value)) return

  ancestors.add(value)
  try {
    const keys = Reflect.ownKeys(value)
    dependencies.push(...keys)
    const descriptors = Object.getOwnPropertyDescriptors(value)
    for (const key of keys) {
      if (typeof key === 'symbol') continue
      if (Array.isArray(value) && key === 'length') continue

      const descriptor = descriptors[key]
      if (!descriptor || !('value' in descriptor)) {
        dependencies.push(descriptor?.get, descriptor?.set)
        continue
      }

      const nested = Reflect.get(value, key)
      collectDirectDependencies(
        nested,
        [...path, Array.isArray(value) && isArrayIndexKey(key) ? Number(key) : key],
        ancestors,
        dependencies,
      )
    }
  }
  catch {
    // Invalid proxy behavior is classified by the shared source resolver.
  }
  finally {
    ancestors.delete(value)
  }
}

export function collectDirectMermaidConfigDependencies(config: unknown): readonly unknown[] {
  const dependencies: unknown[] = []
  collectDirectDependencies(config, [], new Set(), dependencies)
  return dependencies
}
