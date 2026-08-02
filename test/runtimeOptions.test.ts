import { describe, expect, it } from 'vitest'
import {
  resolveRuntimeOptionsSnapshot,
} from '../src/runtime/configuration/runtime-options'
import { resolveExpandOptions } from '../src/configuration/module'

describe('runtime options snapshot resolver', () => {
  it('applies runtime and debug defaults before deeply freezing the owned result', () => {
    const snapshot = resolveRuntimeOptionsSnapshot({})

    expect(snapshot).toMatchObject({
      debug: false,
      loader: {
        init: {
          logLevel: 5,
          suppressErrorRendering: true,
        },
      },
      expand: { enabled: true },
      toolbar: { title: 'mermaid' },
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.loader)).toBe(true)
    expect(Object.isFrozen(snapshot.loader?.init)).toBe(true)
    expect(Object.isFrozen(snapshot.expand)).toBe(true)
    expect(Object.isFrozen(snapshot.toolbar)).toBe(true)
  })

  it('preserves explicit Mermaid debug values and derives only absent values', () => {
    const debugSnapshot = resolveRuntimeOptionsSnapshot({ debug: true })
    const explicitSnapshot = resolveRuntimeOptionsSnapshot({
      debug: true,
      loader: {
        init: {
          logLevel: 0,
          suppressErrorRendering: true,
        },
      },
    })

    expect(debugSnapshot.loader?.init).toMatchObject({
      logLevel: 1,
      suppressErrorRendering: false,
    })
    expect(explicitSnapshot.loader?.init).toMatchObject({
      logLevel: 0,
      suppressErrorRendering: true,
    })
  })

  it('owns the entire tree while preserving property-presence replacements', () => {
    const shared = { values: ['shared'] }
    const payload = {
      debug: false,
      loader: {
        init: {
          extension: shared,
          secondExtension: shared,
          values: [],
          nullable: null,
          count: 0,
          enabled: false,
          label: '',
        },
      },
      toolbar: {
        title: '',
        fontSize: 0,
        buttons: { copy: false },
      },
    }

    const snapshot = resolveRuntimeOptionsSnapshot(payload)
    const init = snapshot.loader?.init as Record<string, unknown>

    expect(init).toMatchObject({
      values: [],
      nullable: null,
      count: 0,
      enabled: false,
      label: '',
    })
    expect(snapshot.toolbar).toMatchObject({
      title: '',
      fontSize: 0,
      buttons: { copy: false, fullscreen: true, expand: true },
    })
    expect(init.extension).not.toBe(shared)
    expect(init.secondExtension).not.toBe(shared)
    expect(init.extension).not.toBe(init.secondExtension)
    expect(Object.isFrozen(shared)).toBe(false)
    expect(Object.isFrozen(payload)).toBe(false)
  })

  it.each([
    ['absent', [undefined], { enabled: true, margin: 0 }],
    ['true reset', [{ margin: 99 }, true], { enabled: true, margin: 0 }],
    ['false reset', [{ margin: 99 }, false], { enabled: false, margin: 0 }],
    ['empty patch', [false, {}], { enabled: false, margin: 0 }],
    ['patch without enabled', [false, { margin: 32 }], { enabled: false, margin: 32 }],
    ['explicit re-enable', [false, { enabled: true, margin: 32 }], { enabled: true, margin: 32 }],
    ['explicit disable patch', [true, { enabled: false, margin: 32 }], { enabled: false, margin: 32 }],
  ] as const)('implements the complete expand reset matrix: %s', (_label, layers, expected) => {
    expect(resolveExpandOptions(layers)).toMatchObject(expected)
  })

  it('fails at the raw runtime phase without accepting activation', () => {
    expect(() => resolveRuntimeOptionsSnapshot({ enabled: false })).toThrowError(
      expect.objectContaining({
        name: 'ContentMermaidConfigurationError',
        code: 'CONTENT_MERMAID_CONFIGURATION_ERROR',
      }),
    )
  })
})
