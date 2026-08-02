import type { JsonObject, JsonValue } from '../types/config'

export interface ConfigurationValidationPhase {
  readonly name: string
  readonly root: string
}

export type ConfigurationIssueCode
  = | 'ACCESSOR_PROPERTY'
    | 'ANCESTOR_CYCLE'
    | 'ARRAY_PROPERTY'
    | 'BIGINT_VALUE'
    | 'FUNCTION_VALUE'
    | 'NEGATIVE_ZERO'
    | 'NON_ENUMERABLE_PROPERTY'
    | 'NON_FINITE_NUMBER'
    | 'NON_PLAIN_OBJECT'
    | 'SPARSE_ARRAY_SLOT'
    | 'SYMBOL_KEY'
    | 'SYMBOL_VALUE'
    | 'UNDEFINED_VALUE'

export interface ConfigurationIssue {
  readonly path: readonly (string | number)[]
  readonly code: ConfigurationIssueCode
  readonly expected: string
  readonly received: string
}

function formatPath(root: string, path: readonly (string | number)[]): string {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === 'number') return `${formatted}[${segment}]`

    return /^[A-Z_$][\w$]*$/i.test(segment)
      ? `${formatted}.${segment}`
      : `${formatted}[${JSON.stringify(segment)}]`
  }, root)
}

function createMessage(
  phase: ConfigurationValidationPhase,
  issues: readonly ConfigurationIssue[],
  truncated: boolean,
): string {
  const details = issues.map(issue =>
    `${formatPath(phase.root, issue.path)}: expected ${issue.expected}; received ${issue.received}`,
  )

  if (truncated) details.push('Additional configuration issues were not listed.')

  return `Invalid ${phase.name}:\n${details.map(detail => `- ${detail}`).join('\n')}`
}

function compareIssues(left: ConfigurationIssue, right: ConfigurationIssue): number {
  const length = Math.min(left.path.length, right.path.length)

  for (let index = 0; index < length; index += 1) {
    const leftSegment = left.path[index]!
    const rightSegment = right.path[index]!
    if (leftSegment === rightSegment) continue
    if (typeof leftSegment === 'number' && typeof rightSegment === 'string') return -1
    if (typeof leftSegment === 'string' && typeof rightSegment === 'number') return 1
    return leftSegment < rightSegment ? -1 : 1
  }

  if (left.path.length !== right.path.length) {
    return left.path.length - right.path.length
  }

  return left.code < right.code ? -1 : left.code > right.code ? 1 : 0
}

export class ContentMermaidConfigurationError extends Error {
  readonly code = 'CONTENT_MERMAID_CONFIGURATION_ERROR'
  override readonly name = 'ContentMermaidConfigurationError'

  constructor(
    readonly phase: ConfigurationValidationPhase,
    readonly issues: readonly ConfigurationIssue[],
    readonly truncated: boolean,
  ) {
    super(createMessage(phase, issues, truncated))
  }
}

interface IssueCollector {
  readonly issues: ConfigurationIssue[]
  truncated: boolean
}

const ISSUE_LIMIT = 50

function isArrayIndexKey(key: string): boolean {
  if (!/^(?:0|[1-9]\d*)$/.test(key)) return false

  const index = Number(key)
  return Number.isInteger(index) && index < 2 ** 32 - 1
}

function reportIssue(collector: IssueCollector, issue: ConfigurationIssue): void {
  if (collector.truncated) return

  collector.issues.push(issue)
  if (collector.issues.length === ISSUE_LIMIT) collector.truncated = true
}

function collectDescriptorIssues(
  descriptor: PropertyDescriptor,
  path: readonly (string | number)[],
  collector: IssueCollector,
  ancestors: Set<object>,
): void {
  if (!('value' in descriptor)) {
    reportIssue(collector, {
      path,
      code: 'ACCESSOR_PROPERTY',
      expected: 'an enumerable data property',
      received: 'accessor',
    })
    return
  }

  if (!descriptor.enumerable) {
    reportIssue(collector, {
      path,
      code: 'NON_ENUMERABLE_PROPERTY',
      expected: 'an enumerable data property',
      received: 'non-enumerable-property',
    })
    return
  }

  collectIssues(descriptor.value, path, collector, ancestors)
}

function collectIssues(
  value: unknown,
  path: readonly (string | number)[],
  collector: IssueCollector,
  ancestors: Set<object>,
): void {
  if (collector.truncated) return

  if (value === undefined) {
    reportIssue(collector, {
      path,
      code: 'UNDEFINED_VALUE',
      expected: 'strict pure data',
      received: 'undefined',
    })
    return
  }

  if (typeof value === 'function') {
    reportIssue(collector, {
      path,
      code: 'FUNCTION_VALUE',
      expected: 'strict pure data',
      received: 'function',
    })
    return
  }

  if (typeof value === 'symbol') {
    reportIssue(collector, {
      path,
      code: 'SYMBOL_VALUE',
      expected: 'strict pure data',
      received: 'symbol',
    })
    return
  }

  if (typeof value === 'bigint') {
    reportIssue(collector, {
      path,
      code: 'BIGINT_VALUE',
      expected: 'strict pure data',
      received: 'bigint',
    })
    return
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    reportIssue(collector, {
      path,
      code: 'NON_FINITE_NUMBER',
      expected: 'a finite number',
      received: 'non-finite-number',
    })
    return
  }

  if (typeof value === 'number' && Object.is(value, -0)) {
    reportIssue(collector, {
      path,
      code: 'NEGATIVE_ZERO',
      expected: 'a finite number other than negative zero',
      received: 'negative-zero',
    })
    return
  }

  if (value === null || typeof value !== 'object') return

  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    reportIssue(collector, {
      path,
      code: 'NON_PLAIN_OBJECT',
      expected: 'a plain object or array',
      received: 'non-plain-object',
    })
    return
  }

  if (ancestors.has(value)) {
    reportIssue(collector, {
      path,
      code: 'ANCESTOR_CYCLE',
      expected: 'an acyclic strict pure-data tree',
      received: 'ancestor-cycle',
    })
    return
  }

  ancestors.add(value)
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value)
    const symbolKeys = Reflect.ownKeys(descriptors).filter(key => typeof key === 'symbol')
    if (symbolKeys.length > 0) {
      reportIssue(collector, {
        path,
        code: 'SYMBOL_KEY',
        expected: 'string-keyed strict pure data',
        received: 'symbol-key',
      })
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length && !collector.truncated; index += 1) {
        const descriptor = descriptors[String(index)]
        const propertyPath = [...path, index]
        if (!descriptor) {
          reportIssue(collector, {
            path: propertyPath,
            code: 'SPARSE_ARRAY_SLOT',
            expected: 'a present strict pure-data value',
            received: 'missing-array-slot',
          })
          continue
        }

        collectDescriptorIssues(descriptor, propertyPath, collector, ancestors)
      }

      const extraKeys = Object.keys(descriptors)
        .filter(key => key !== 'length' && !isArrayIndexKey(key))
        .sort()

      for (const key of extraKeys) {
        reportIssue(collector, {
          path: [...path, key],
          code: 'ARRAY_PROPERTY',
          expected: 'an array index',
          received: 'array-property',
        })
      }
      return
    }

    const keys = Object.keys(descriptors).sort()

    for (const key of keys) {
      if (collector.truncated) break

      const descriptor = descriptors[key]
      if (!descriptor) continue

      const propertyPath = [...path, key]
      collectDescriptorIssues(descriptor, propertyPath, collector, ancestors)
    }
  }
  finally {
    ancestors.delete(value)
  }
}

export function assertStrictData(
  value: unknown,
  phase: ConfigurationValidationPhase,
): asserts value is JsonValue {
  const collector: IssueCollector = { issues: [], truncated: false }
  collectIssues(value, [], collector, new Set())
  collector.issues.sort(compareIssues)

  if (collector.issues.length > 0) {
    throw new ContentMermaidConfigurationError(
      phase,
      collector.issues,
      collector.truncated,
    )
  }
}

function isPlainObject(value: unknown): value is JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function assertMergeSafe(value: unknown, ancestors: Set<object>): void {
  if (value === null || typeof value !== 'object') return
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError('Property-Presence Merge accepts only normalized data')
  }
  if (ancestors.has(value)) {
    throw new TypeError('Property-Presence Merge does not accept cyclic data')
  }

  ancestors.add(value)
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value)
    if (Reflect.ownKeys(descriptors).some(key => typeof key === 'symbol')) {
      throw new TypeError('Property-Presence Merge does not accept symbol keys')
    }

    for (const key of Object.keys(descriptors)) {
      if (Array.isArray(value) && key === 'length') continue
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        throw new TypeError(`Unsafe configuration key: ${key}`)
      }

      const descriptor = descriptors[key]
      if (!descriptor || !('value' in descriptor)) {
        throw new TypeError('Property-Presence Merge does not accept accessors')
      }
      assertMergeSafe(descriptor.value, ancestors)
    }
  }
  finally {
    ancestors.delete(value)
  }
}

function defineOwnedProperty(target: object, key: string, value: JsonValue): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

function cloneData(value: JsonValue, ancestors: Set<object>): JsonValue {
  if (value === null || typeof value !== 'object') return value
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError('Cannot clone non-plain configuration data')
  }
  if (ancestors.has(value)) throw new TypeError('Cannot clone cyclic configuration data')

  ancestors.add(value)
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value)
    if (Reflect.ownKeys(descriptors).some(key => typeof key === 'symbol')) {
      throw new TypeError('Cannot clone symbol-keyed configuration data')
    }

    if (Array.isArray(value)) {
      const clone: JsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)]
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
          throw new TypeError('Cannot clone non-data configuration properties')
        }
        clone.push(cloneData(descriptor.value as JsonValue, ancestors))
      }

      const extraKeys = Object.keys(descriptors)
        .filter(key => key !== 'length' && !isArrayIndexKey(key))
      if (extraKeys.length > 0) {
        throw new TypeError('Cannot clone non-index array properties')
      }
      return clone
    }

    const clone: JsonObject = {}

    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key]
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        throw new TypeError('Cannot clone non-data configuration properties')
      }
      defineOwnedProperty(clone, key, cloneData(descriptor.value as JsonValue, ancestors))
    }

    return clone
  }
  finally {
    ancestors.delete(value)
  }
}

export function cloneOwnedData<T extends JsonValue>(value: T): T {
  return cloneData(value, new Set()) as T
}

export type DeepReadonlyData<T>
  = T extends readonly (infer Item)[]
    ? readonly DeepReadonlyData<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonlyData<T[Key]> }
      : T

function deepFreezeData(value: JsonValue): void {
  if (value === null || typeof value !== 'object') return

  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Object.keys(descriptors)) {
    if (Array.isArray(value) && key === 'length') continue

    const descriptor = descriptors[key]
    if (descriptor && 'value' in descriptor) {
      deepFreezeData(descriptor.value as JsonValue)
    }
  }
  Object.freeze(value)
}

export function cloneAndDeepFreezeOwnedData<T extends JsonValue>(
  value: T,
): DeepReadonlyData<T> {
  const clone = cloneOwnedData(value)
  deepFreezeData(clone)
  return clone as DeepReadonlyData<T>
}

function mergeObjects(lower: JsonObject, higher: object): JsonObject {
  const result = cloneData(lower, new Set()) as JsonObject
  const higherDescriptors = Object.getOwnPropertyDescriptors(higher)

  for (const key of Object.keys(higherDescriptors).sort()) {
    const higherDescriptor = higherDescriptors[key]
    if (!higherDescriptor || !('value' in higherDescriptor)) {
      throw new TypeError('Cannot merge non-data configuration properties')
    }

    const lowerDescriptor = Object.getOwnPropertyDescriptor(result, key)
    const lowerValue = lowerDescriptor && 'value' in lowerDescriptor
      ? lowerDescriptor.value as JsonValue
      : undefined
    const higherValue = higherDescriptor.value as JsonValue
    const mergedValue = lowerDescriptor && isPlainObject(lowerValue) && isPlainObject(higherValue)
      ? mergeObjects(lowerValue, higherValue)
      : cloneData(higherValue, new Set())

    defineOwnedProperty(result, key, mergedValue)
  }

  return result
}

export function mergeByPresence(layers: readonly object[]): JsonObject {
  for (const layer of layers) {
    if (!isPlainObject(layer)) {
      throw new TypeError('Property-Presence Merge layers must be plain objects')
    }
    assertMergeSafe(layer, new Set())
  }

  return layers.reduce<JsonObject>(
    (result, layer) => mergeObjects(result, layer),
    {},
  )
}
