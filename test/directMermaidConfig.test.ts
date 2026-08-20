import type { MermaidConfig } from 'mermaid'
import { describe, expect, it } from 'vitest'
import { materializeDirectMermaidConfigForInvocation } from '../src/runtime/direct-mermaid-config'

function configAtPath(path: readonly string[], value: unknown): MermaidConfig {
  const config: Record<string, unknown> = {}
  let current = config
  for (const segment of path.slice(0, -1)) {
    const nested: Record<string, unknown> = {}
    current[segment] = nested
    current = nested
  }
  current[path.at(-1)!] = value
  return config as MermaidConfig
}

function valueAtPath(config: MermaidConfig, path: readonly string[]): unknown {
  return path.reduce<unknown>((value, segment) => {
    return (value as Record<string, unknown>)[segment]
  }, config)
}

describe('Direct Mermaid Config materialization', () => {
  const componentConfigurationErrorFingerprint = {
    name: 'MermaidComponentConfigurationError',
    code: 'CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR',
  } as const

  it('isolates structural data per invocation while preserving shared references within one copy', () => {
    const shared = { values: ['input'] }
    const input = {
      extension: {
        first: shared,
        second: shared,
      },
    }

    const first = materializeDirectMermaidConfigForInvocation(input as unknown as MermaidConfig) as MermaidConfig & {
      extension: { first: typeof shared, second: typeof shared }
    }
    const second = materializeDirectMermaidConfigForInvocation(input as unknown as MermaidConfig) as MermaidConfig & {
      extension: { first: typeof shared, second: typeof shared }
    }

    expect(first).not.toBe(input)
    expect(first.extension).not.toBe(input.extension)
    expect(first.extension.first).not.toBe(shared)
    expect(first.extension.first).toBe(first.extension.second)
    expect(first.extension.first).not.toBe(second.extension.first)

    first.extension.first.values.push('first invocation')

    expect(shared.values).toEqual(['input'])
    expect(second.extension.first.values).toEqual(['input'])
  })

  it('rejects cyclic structural data', () => {
    const input: Record<string, unknown> = {}
    input.self = input

    expect(() => materializeDirectMermaidConfigForInvocation(
      input as MermaidConfig,
    )).toThrow('config.self')
  })

  it('recreates supported RegExp values with equivalent state', () => {
    const pattern = /https?:\/\//gi
    pattern.lastIndex = 4
    const input = {
      dompurifyConfig: {
        ALLOWED_URI_REGEXP: pattern,
        CUSTOM_ELEMENT_HANDLING: {
          tagNameCheck: pattern,
        },
      },
    } satisfies MermaidConfig

    const copy = materializeDirectMermaidConfigForInvocation(input)
    const allowedUri = copy.dompurifyConfig?.ALLOWED_URI_REGEXP
    const tagNameCheck = copy.dompurifyConfig?.CUSTOM_ELEMENT_HANDLING?.tagNameCheck

    expect(allowedUri).toBeInstanceOf(RegExp)
    expect(allowedUri).not.toBe(pattern)
    expect(allowedUri).toBe(tagNameCheck)
    expect(allowedUri).toMatchObject({
      source: 'https?:\\/\\/',
      flags: 'gi',
      lastIndex: 4,
    })
  })

  it.each([
    ['string', (pattern: RegExp) => Object.defineProperty(pattern, 'custom', { value: true, enumerable: true })],
    ['symbol', (pattern: RegExp) => Object.defineProperty(pattern, Symbol('custom'), { value: true, enumerable: true })],
  ])('rejects RegExp values with custom %s properties', (_kind, addCustomProperty) => {
    const pattern = /safe/
    addCustomProperty(pattern)

    expect(() => materializeDirectMermaidConfigForInvocation({
      dompurifyConfig: { ALLOWED_URI_REGEXP: pattern },
    })).toThrow('config.dompurifyConfig.ALLOWED_URI_REGEXP')
  })

  it('retains provider identity without traversing supported opaque capabilities', () => {
    let inspections = 0
    const fontCallback = Object.defineProperty(
      () => ({ fontSize: 16 }),
      'state',
      { get: () => ++inspections },
    )
    const addTags = () => true
    const trustedTypesPolicy = Object.defineProperty({}, 'createHTML', {
      get: () => ++inspections,
    }) as NonNullable<NonNullable<MermaidConfig['dompurifyConfig']>['TRUSTED_TYPES_POLICY']>
    const input = {
      sequence: { actorFont: fontCallback },
      c4: { boundaryFont: fontCallback },
      dompurifyConfig: {
        ADD_TAGS: addTags,
        TRUSTED_TYPES_POLICY: trustedTypesPolicy,
      },
    } satisfies MermaidConfig

    const copy = materializeDirectMermaidConfigForInvocation(input)

    expect(copy.sequence?.actorFont).toBe(fontCallback)
    expect(copy.c4?.boundaryFont).toBe(fontCallback)
    expect(copy.dompurifyConfig?.ADD_TAGS).toBe(addTags)
    expect(copy.dompurifyConfig?.TRUSTED_TYPES_POLICY).toBe(trustedTypesPolicy)
    expect(Object.isFrozen(fontCallback)).toBe(false)
    expect(Object.isFrozen(trustedTypesPolicy)).toBe(false)
    expect(inspections).toBe(0)
  })

  it('supports the exact Mermaid 11.17.0 font callback paths', () => {
    const callback = () => ({ fontSize: 16 })
    const supportedPaths = [
      ['sequence', 'actorFont'],
      ['sequence', 'messageFont'],
      ['sequence', 'noteFont'],
      ...[
        'personFont',
        'external_personFont',
        'systemFont',
        'external_systemFont',
        'system_dbFont',
        'external_system_dbFont',
        'system_queueFont',
        'external_system_queueFont',
        'containerFont',
        'external_containerFont',
        'container_dbFont',
        'external_container_dbFont',
        'container_queueFont',
        'external_container_queueFont',
        'componentFont',
        'external_componentFont',
        'component_dbFont',
        'external_component_dbFont',
        'component_queueFont',
        'external_component_queueFont',
        'boundaryFont',
        'messageFont',
      ].map(key => ['c4', key]),
    ]

    for (const path of supportedPaths) {
      const copy = materializeDirectMermaidConfigForInvocation(configAtPath(path, callback))
      expect(valueAtPath(copy, path), path.join('.')).toBe(callback)
    }
  })

  it('supports the exact DOMPurify 3.4.13 callback and RegExp paths', () => {
    const callback = () => true
    const callbackPaths = [
      ['dompurifyConfig', 'ADD_ATTR'],
      ['dompurifyConfig', 'ADD_TAGS'],
      ['dompurifyConfig', 'CUSTOM_ELEMENT_HANDLING', 'attributeNameCheck'],
      ['dompurifyConfig', 'CUSTOM_ELEMENT_HANDLING', 'tagNameCheck'],
    ]
    const regexpPaths = [
      ['dompurifyConfig', 'ALLOWED_URI_REGEXP'],
      ['dompurifyConfig', 'CUSTOM_ELEMENT_HANDLING', 'attributeNameCheck'],
      ['dompurifyConfig', 'CUSTOM_ELEMENT_HANDLING', 'tagNameCheck'],
    ]

    for (const path of callbackPaths) {
      const copy = materializeDirectMermaidConfigForInvocation(configAtPath(path, callback))
      expect(valueAtPath(copy, path), path.join('.')).toBe(callback)
    }
    for (const path of regexpPaths) {
      const pattern = /supported/i
      const copy = materializeDirectMermaidConfigForInvocation(configAtPath(path, pattern))
      expect(valueAtPath(copy, path), path.join('.')).toEqual(/supported/i)
      expect(valueAtPath(copy, path), path.join('.')).not.toBe(pattern)
    }
  })

  it('identifies the frozen Mermaid baseline in unsupported capability errors', () => {
    const materializeUnsupportedCapability = () => materializeDirectMermaidConfigForInvocation({
      flowchart: { curve: () => 'basis' },
    } as unknown as MermaidConfig)

    expect(materializeUnsupportedCapability).toThrowError(expect.objectContaining({
      message: expect.stringContaining('exact Mermaid 11.17.0'),
    }))
    expect(materializeUnsupportedCapability).toThrowError(expect.objectContaining({
      message: expect.stringContaining('DOMPurify 3.4.13'),
    }))
  })

  it.each([
    ['function', { flowchart: { curve: () => 'basis' } }, 'config.flowchart.curve'],
    ['function at a dotted lookalike key', { 'sequence.actorFont': () => ({}) }, 'config.sequence.actorFont'],
    ['RegExp', { flowchart: { curve: /basis/ } }, 'config.flowchart.curve'],
    [
      'RegExp at a dotted lookalike key',
      { dompurifyConfig: { 'CUSTOM_ELEMENT_HANDLING.tagNameCheck': /basis/ } },
      'config.dompurifyConfig.CUSTOM_ELEMENT_HANDLING.tagNameCheck',
    ],
    ['non-plain instance', { extension: new Date(0) }, 'config.extension'],
  ])('rejects an unsupported %s before Mermaid receives it', (_kind, input, path) => {
    expect(() => materializeDirectMermaidConfigForInvocation(
      input as unknown as MermaidConfig,
    )).toThrowError(expect.objectContaining({
      ...componentConfigurationErrorFingerprint,
      message: expect.stringContaining(path),
    }))
  })
})
