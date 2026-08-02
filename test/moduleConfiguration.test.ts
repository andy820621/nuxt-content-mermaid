import { describe, expect, it } from 'vitest'
import { resolveModuleConfiguration } from '../src/configuration/module'

describe('module configuration resolver', () => {
  it('merges package defaults, Nuxt options, and runtime overrides in order without transporting activation', () => {
    const result = resolveModuleConfiguration({
      nuxtResolvedOptions: {
        enabled: false,
        debug: true,
        toolbar: { title: 'Nuxt option', buttons: { copy: false } },
        loader: { init: { theme: 'forest' } },
        expand: false,
      },
      runtimeOverrides: {
        debug: false,
        toolbar: { title: '', buttons: { fullscreen: false } },
        loader: { init: { unknownMermaidExtension: { values: [] } } },
        expand: { margin: 24 },
      },
    })

    expect(result.enabled).toBe(false)
    expect(result.runtimeOptions).toMatchObject({
      debug: false,
      toolbar: {
        title: '',
        buttons: { copy: false, fullscreen: false, expand: true },
      },
      loader: {
        init: {
          theme: 'forest',
          unknownMermaidExtension: { values: [] },
        },
      },
      expand: { enabled: false, margin: 24 },
    })
    expect(result.runtimeOptions).not.toHaveProperty('enabled')
  })

  it('rejects activation in runtime overrides even when the module is disabled', () => {
    expect(() => resolveModuleConfiguration({
      nuxtResolvedOptions: { enabled: false },
      runtimeOverrides: { enabled: false },
    })).toThrowError(expect.objectContaining({
      name: 'ContentMermaidConfigurationError',
      code: 'CONTENT_MERMAID_CONFIGURATION_ERROR',
    }))
  })

  it('validates application-owned descriptors without invoking getters', () => {
    let getterCalls = 0
    const runtimeOverrides = {}
    Object.defineProperty(runtimeOverrides, 'debug', {
      enumerable: true,
      get() {
        getterCalls += 1
        return true
      },
    })

    expect(() => resolveModuleConfiguration({
      nuxtResolvedOptions: {},
      runtimeOverrides,
    })).toThrowError(expect.objectContaining({
      name: 'ContentMermaidConfigurationError',
      code: 'CONTENT_MERMAID_CONFIGURATION_ERROR',
    }))
    expect(getterCalls).toBe(0)
  })

  it('returns a mutable owned runtime payload', () => {
    const overrides = { toolbar: { title: 'application input' } }
    const result = resolveModuleConfiguration({
      nuxtResolvedOptions: {},
      runtimeOverrides: overrides,
    })

    expect(result.runtimeOptions).not.toBe(overrides)
    expect(result.runtimeOptions.toolbar).not.toBe(overrides.toolbar)
    expect(Object.isFrozen(result.runtimeOptions)).toBe(false)

    result.runtimeOptions.toolbar!.title = 'package-owned result'
    expect(overrides.toolbar.title).toBe('application input')
  })
})
