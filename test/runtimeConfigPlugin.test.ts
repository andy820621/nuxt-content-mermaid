import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRuntimeMermaidSnapshot } from '../src/runtime/runtime-snapshot'

const state = vi.hoisted(() => ({
  payload: {} as unknown,
}))

vi.mock('#app', () => ({
  defineNuxtPlugin: (plugin: (nuxtApp: object) => unknown) => plugin,
  useRuntimeConfig: () => ({
    public: { contentMermaid: state.payload },
  }),
}))

type RuntimeConfigPlugin = (nuxtApp: object) => unknown

describe('Universal Runtime Adapter plugin', () => {
  beforeEach(() => {
    state.payload = {}
  })

  it('installs the received public payload once for each app', async () => {
    const firstApp = {}
    const secondApp = {}
    const module = await import('../src/runtime/plugins/runtime-config')
    const plugin = module.default as unknown as RuntimeConfigPlugin

    state.payload = { theme: { light: 'neutral' } }
    plugin(firstApp)
    state.payload = { theme: { light: 'forest' } }
    plugin(secondApp)

    expect(getRuntimeMermaidSnapshot(firstApp).theme?.light).toBe('neutral')
    expect(getRuntimeMermaidSnapshot(secondApp).theme?.light).toBe('forest')
  })

  it('fails initialization without publishing a partial snapshot', async () => {
    const nuxtApp = {}
    const module = await import('../src/runtime/plugins/runtime-config')
    const plugin = module.default as unknown as RuntimeConfigPlugin
    state.payload = { enabled: true }

    expect(() => plugin(nuxtApp)).toThrowError(
      expect.objectContaining({ name: 'ContentMermaidConfigurationError' }),
    )
    expect(() => getRuntimeMermaidSnapshot(nuxtApp)).toThrow(
      'Runtime Mermaid Snapshot has not been installed for this NuxtApp',
    )
  })
})
