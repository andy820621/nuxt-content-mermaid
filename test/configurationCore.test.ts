import type { JsonValue } from '../src/types/config'
import { describe, expect, it } from 'vitest'
import {
  ContentMermaidConfigurationError,
  assertStrictData,
  cloneAndDeepFreezeOwnedData,
  cloneOwnedData,
  mergeByPresence,
} from '../src/configuration/core'

const runtimeOptionsPhase = {
  name: 'Runtime Mermaid Options',
  root: 'runtimeConfig.public.contentMermaid',
} as const

function captureConfigurationError(value: unknown): ContentMermaidConfigurationError {
  try {
    assertStrictData(value, runtimeOptionsPhase)
  }
  catch (error) {
    expect(error).toBeInstanceOf(ContentMermaidConfigurationError)
    return error as ContentMermaidConfigurationError
  }

  throw new Error('Expected validation to fail')
}

describe('configuration core validation', () => {
  it('reports accessors and invalid safe siblings without executing application behavior', () => {
    let getterCalls = 0
    let setterCalls = 0
    let toJSONCalls = 0
    const input = {
      invalidFunction: () => undefined,
      toJSON: () => {
        toJSONCalls += 1
        return {}
      },
    }

    Object.defineProperty(input, 'accessor', {
      enumerable: true,
      get() {
        getterCalls += 1
        return 'unsafe'
      },
    })
    Object.defineProperty(input, 'setter', {
      enumerable: true,
      set() {
        setterCalls += 1
      },
    })

    const error = captureConfigurationError(input)

    expect(error).toMatchObject({
      name: 'ContentMermaidConfigurationError',
      code: 'CONTENT_MERMAID_CONFIGURATION_ERROR',
      phase: runtimeOptionsPhase,
      truncated: false,
      issues: [
        {
          path: ['accessor'],
          code: 'ACCESSOR_PROPERTY',
          expected: 'an enumerable data property',
          received: 'accessor',
        },
        {
          path: ['invalidFunction'],
          code: 'FUNCTION_VALUE',
          expected: 'strict pure data',
          received: 'function',
        },
        {
          path: ['setter'],
          code: 'ACCESSOR_PROPERTY',
          expected: 'an enumerable data property',
          received: 'accessor',
        },
        {
          path: ['toJSON'],
          code: 'FUNCTION_VALUE',
          expected: 'strict pure data',
          received: 'function',
        },
      ],
    })
    expect(error.message).toContain('runtimeConfig.public.contentMermaid.accessor')

    expect(getterCalls).toBe(0)
    expect(setterCalls).toBe(0)
    expect(toJSONCalls).toBe(0)
  })

  it.each([
    ['undefined', undefined, 'UNDEFINED_VALUE', 'undefined'],
    ['symbol', Symbol('invalid'), 'SYMBOL_VALUE', 'symbol'],
    ['bigint', 1n, 'BIGINT_VALUE', 'bigint'],
    ['NaN', Number.NaN, 'NON_FINITE_NUMBER', 'non-finite-number'],
    ['positive infinity', Number.POSITIVE_INFINITY, 'NON_FINITE_NUMBER', 'non-finite-number'],
    ['negative infinity', Number.NEGATIVE_INFINITY, 'NON_FINITE_NUMBER', 'non-finite-number'],
    ['negative zero', -0, 'NEGATIVE_ZERO', 'negative-zero'],
    ['non-plain instance', new Date(0), 'NON_PLAIN_OBJECT', 'non-plain-object'],
  ])('rejects %s as strict pure data', (_label, value, code, received) => {
    expect(captureConfigurationError(value)).toMatchObject({
      issues: [{ path: [], code, received }],
      truncated: false,
    })
  })

  it('reports ancestor cycles while validating shared references at every reachable path', () => {
    const shared = { invalid: undefined }
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const input = {
      first: shared,
      second: shared,
      cyclic,
    }

    expect(captureConfigurationError(input)).toMatchObject({
      issues: [
        { path: ['cyclic', 'self'], code: 'ANCESTOR_CYCLE' },
        { path: ['first', 'invalid'], code: 'UNDEFINED_VALUE' },
        { path: ['second', 'invalid'], code: 'UNDEFINED_VALUE' },
      ],
    })
  })

  it('rejects non-transport object and array structure with deterministic paths', () => {
    const sparse: unknown[] & { extra?: boolean } = []
    sparse.length = 3
    sparse[1] = 'present'
    sparse.extra = true
    const input = { sparse }

    Object.defineProperty(input, 'hidden', {
      enumerable: false,
      value: 'not transported',
    })
    Object.defineProperty(input, Symbol('symbol-key'), {
      enumerable: true,
      value: 'not addressable',
    })

    expect(captureConfigurationError(input)).toMatchObject({
      issues: [
        { path: [], code: 'SYMBOL_KEY' },
        { path: ['hidden'], code: 'NON_ENUMERABLE_PROPERTY' },
        { path: ['sparse', 0], code: 'SPARSE_ARRAY_SLOT' },
        { path: ['sparse', 2], code: 'SPARSE_ARRAY_SLOT' },
        { path: ['sparse', 'extra'], code: 'ARRAY_PROPERTY' },
      ],
    })
  })

  it('stops on the fiftieth safely observable issue and reports truncation', () => {
    const input = Array.from({ length: 50 }, () => undefined)

    const error = captureConfigurationError(input)

    expect(error).toMatchObject({ truncated: true })
    expect(error.issues).toHaveLength(50)
    expect(error.issues[0]?.path).toEqual([0])
    expect(error.issues[49]?.path).toEqual([49])
    expect(error.message).toContain('Additional configuration issues were not listed.')
  })

  it('accepts the agreed primitives, dense arrays, plain objects, and shared references', () => {
    const shared = { value: 'shared' }
    const nullPrototype = Object.create(null) as Record<string, unknown>
    nullPrototype.nested = [null, true, false, 0, 1.5, '', 'value']

    expect(() => assertStrictData({ shared, again: shared, nullPrototype }, runtimeOptionsPhase))
      .not.toThrow()
  })

  it('rejects numeric-looking array properties that are outside the index range', () => {
    const input: unknown[] = []
    Object.defineProperty(input, '4294967295', {
      enumerable: true,
      value: 'not an array index',
    })

    expect(captureConfigurationError(input)).toMatchObject({
      issues: [{ path: ['4294967295'], code: 'ARRAY_PROPERTY' }],
    })
  })
})

describe('property-presence merge', () => {
  it('merges layers in order while preserving every explicit replacement value', () => {
    const lowest = {
      nested: { inherited: 'lowest' },
      array: ['lowest'],
      nullable: 'fallback',
      enabled: true,
      count: 1,
      label: 'fallback',
    }
    const middle = {
      nested: null,
      array: ['middle'],
    }
    const highest = {
      nested: { highest: true },
      array: [],
      nullable: null,
      enabled: false,
      count: 0,
      label: '',
    }

    const result = mergeByPresence([lowest, middle, highest])

    expect(result).toEqual({
      nested: { highest: true },
      array: [],
      nullable: null,
      enabled: false,
      count: 0,
      label: '',
    })
    expect(result).not.toBe(highest)
    expect(result.nested).not.toBe(highest.nested)
    expect(result.array).not.toBe(highest.array)
    expect(lowest).toEqual({
      nested: { inherited: 'lowest' },
      array: ['lowest'],
      nullable: 'fallback',
      enabled: true,
      count: 1,
      label: 'fallback',
    })
  })

  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects the prototype-pollution key %s at any depth',
    (unsafeKey) => {
      const nested = Object.create(null) as Record<string, unknown>
      Object.defineProperty(nested, unsafeKey, {
        enumerable: true,
        value: { polluted: true },
      })

      expect(() => mergeByPresence([{ safe: { nested } }])).toThrow(
        `Unsafe configuration key: ${unsafeKey}`,
      )
      expect(Object.prototype).not.toHaveProperty('polluted')
    },
  )

  it('does not invoke accessors while rejecting an unnormalized layer', () => {
    let getterCalls = 0
    const layer = {}
    Object.defineProperty(layer, 'unsafe', {
      enumerable: true,
      get() {
        getterCalls += 1
        return 'unsafe'
      },
    })

    expect(() => mergeByPresence([layer])).toThrow(
      'Property-Presence Merge does not accept accessors',
    )
    expect(getterCalls).toBe(0)
  })
})

describe('owned configuration data', () => {
  it('clones every reachable path without retaining mutable transport references', () => {
    const shared = { nested: { value: 'transport' } }
    const input = {
      first: shared,
      second: shared,
      list: [shared],
    }

    const clone = cloneOwnedData(input)

    expect(clone).toEqual(input)
    expect(clone).not.toBe(input)
    expect(clone.first).not.toBe(shared)
    expect(clone.second).not.toBe(shared)
    expect(clone.first).not.toBe(clone.second)
    expect(clone.list).not.toBe(input.list)
    expect(clone.list[0]).not.toBe(shared)

    clone.first.nested.value = 'owned'
    expect(shared.nested.value).toBe('transport')
    expect(clone.second.nested.value).toBe('transport')
  })

  it('deep-freezes an owned clone without freezing transport input', () => {
    const input = {
      nested: { value: 'transport' },
      list: [{ enabled: true }],
    }

    const frozen = cloneAndDeepFreezeOwnedData(input)

    expect(frozen).toEqual(input)
    expect(frozen).not.toBe(input)
    expect(frozen.nested).not.toBe(input.nested)
    expect(frozen.list).not.toBe(input.list)
    expect(Object.isFrozen(frozen)).toBe(true)
    expect(Object.isFrozen(frozen.nested)).toBe(true)
    expect(Object.isFrozen(frozen.list)).toBe(true)
    expect(Object.isFrozen(frozen.list[0])).toBe(true)
    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(input.nested)).toBe(false)
  })

  it('does not invoke array accessors when rejecting invalid clone input', () => {
    let getterCalls = 0
    const input: unknown[] = []
    Object.defineProperty(input, 0, {
      enumerable: true,
      get() {
        getterCalls += 1
        return 'unsafe'
      },
    })

    expect(() => cloneOwnedData(input as JsonValue)).toThrow(
      'Cannot clone non-data configuration properties',
    )
    expect(getterCalls).toBe(0)
  })
})
