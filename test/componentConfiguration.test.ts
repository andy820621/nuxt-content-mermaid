import { describe, expect, expectTypeOf, it } from 'vitest'
import type { PageMermaidConfig } from '../src/types/config'
import type { MermaidComponentSource } from '../src/runtime/component-configuration'
import { resolveMermaidComponentSource } from '../src/runtime/component-configuration'

const componentConfigurationErrorFingerprint = {
  name: 'MermaidComponentConfigurationError',
  code: 'CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR',
} as const

function expectComponentConfigurationError(action: () => unknown) {
  expect(action).toThrow(expect.objectContaining(componentConfigurationErrorFingerprint))
}

describe('Component Source Resolver', () => {
  it('distinguishes runtime-only, page, direct, and conflict sources', () => {
    const pageConfig = { theme: 'forest' } as const
    const directConfig = { theme: 'dark' } as const

    expect(resolveMermaidComponentSource({})).toEqual({ kind: 'runtime-only' })
    expect(resolveMermaidComponentSource({ pageConfig })).toEqual({
      kind: 'page',
      config: { theme: 'forest' },
    })
    expect(resolveMermaidComponentSource({ config: directConfig })).toEqual({
      kind: 'direct',
      config: { theme: 'dark' },
    })

    const conflict = resolveMermaidComponentSource({ pageConfig, config: directConfig })
    expect(conflict.kind).toBe('conflict')
  })

  it('reports a source conflict before inspecting either payload', () => {
    let inspections = 0
    const pageConfig = Object.defineProperty({}, 'theme', {
      enumerable: true,
      get() {
        inspections += 1
        return 'forest'
      },
    })
    const directConfig = new Proxy({}, {
      ownKeys() {
        inspections += 1
        return []
      },
    })

    const outcome = resolveMermaidComponentSource({ pageConfig, config: directConfig })

    expect(outcome).toEqual({
      kind: 'conflict',
      error: expect.objectContaining(componentConfigurationErrorFingerprint),
    })
    expect(inspections).toBe(0)
  })

  it('treats only undefined as absent and rejects null source payloads', () => {
    expect(resolveMermaidComponentSource({ pageConfig: undefined })).toEqual({
      kind: 'runtime-only',
    })

    expectComponentConfigurationError(() => resolveMermaidComponentSource({ pageConfig: null }))
    expectComponentConfigurationError(() => resolveMermaidComponentSource({ config: null }))
  })

  it('rejects unsupported Direct Mermaid Config through the shared source resolver', () => {
    expectComponentConfigurationError(() => resolveMermaidComponentSource({
      config: {
        flowchart: {
          curve: () => 'basis',
        },
      },
    }))
  })

  it('rejects non-pure page data without invoking accessors', () => {
    let getterCalls = 0
    const accessorConfig = Object.defineProperty({}, 'theme', {
      enumerable: true,
      get() {
        getterCalls += 1
        return 'forest'
      },
    })

    for (const pageConfig of [
      { unknownMermaidExtension: { load: () => ({}) } },
      accessorConfig,
      new Date(),
    ]) {
      expectComponentConfigurationError(() => resolveMermaidComponentSource({ pageConfig }))
    }
    expect(getterCalls).toBe(0)
  })

  it('validates the Mermaid fields interpreted by the package', () => {
    for (const pageConfig of [
      { theme: null },
      { logLevel: false },
      { suppressErrorRendering: 'yes' },
    ]) {
      expectComponentConfigurationError(() => resolveMermaidComponentSource({ pageConfig }))
    }
  })

  it('preserves unknown Mermaid-owned pure-data keys', () => {
    const pageConfig = {
      unknownMermaidExtension: {
        enabled: false,
        values: [null, 1, 'kept'],
      },
    }

    expect(resolveMermaidComponentSource({ pageConfig })).toEqual({
      kind: 'page',
      config: {
        unknownMermaidExtension: {
          enabled: false,
          values: [null, 1, 'kept'],
        },
      },
    })
  })

  it('exposes discriminated outcome types to downstream consumers', () => {
    expectTypeOf<Extract<MermaidComponentSource, { kind: 'page' }>['config']>()
      .toEqualTypeOf<PageMermaidConfig>()
    expectTypeOf<Extract<MermaidComponentSource, { kind: 'conflict' }>['error']>()
      .toMatchTypeOf<Error & { readonly code: string }>()
  })
})
