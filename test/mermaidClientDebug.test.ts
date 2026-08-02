import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getRuntimeMermaidSnapshot,
  installRuntimeMermaidSnapshot,
} from '../src/runtime/runtime-snapshot'

vi.mock('#app', () => ({
  defineNuxtPlugin: (plugin: (nuxtApp: object) => unknown) => plugin,
}))

const initialize = vi.fn()
const mermaidInstance = { initialize }

vi.mock('mermaid', () => ({
  default: mermaidInstance,
}))

interface MermaidPluginResult {
  provide: {
    mermaid: () => Promise<unknown>
  }
}

type MermaidPluginFactory = (nuxtApp: object) => unknown

async function createPluginFor(
  nuxtApp: object,
  payload: unknown,
): Promise<MermaidPluginResult> {
  installRuntimeMermaidSnapshot(nuxtApp, payload)
  const module = await import('../src/runtime/plugins/mermaid.client')
  const plugin = module.default as unknown as MermaidPluginFactory
  return plugin(nuxtApp) as MermaidPluginResult
}

describe('mermaid client plugin runtime snapshot behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies debug-friendly defaults from the installed snapshot', async () => {
    const plugin = await createPluginFor({}, { debug: true })
    await plugin.provide.mermaid()

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      logLevel: 1,
      suppressErrorRendering: false,
    }))
  })

  it('respects explicit init overrides even in debug mode', async () => {
    const plugin = await createPluginFor({}, {
      debug: true,
      loader: { init: { logLevel: 0, suppressErrorRendering: true } },
    })
    await plugin.provide.mermaid()

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      logLevel: 0,
      suppressErrorRendering: true,
    }))
  })

  it('keeps error rendering suppressed when debug is disabled', async () => {
    const plugin = await createPluginFor({}, { debug: false })
    await plugin.provide.mermaid()

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      logLevel: 5,
      suppressErrorRendering: true,
    }))
  })

  it('does not reread public runtime config after snapshot installation', async () => {
    const nuxtApp = {}
    const publicPayload = { debug: false }
    installRuntimeMermaidSnapshot(nuxtApp, publicPayload)
    publicPayload.debug = true

    const module = await import('../src/runtime/plugins/mermaid.client')
    const pluginFactory = module.default as unknown as MermaidPluginFactory
    const plugin = pluginFactory(nuxtApp) as MermaidPluginResult
    await plugin.provide.mermaid()

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      logLevel: 5,
      suppressErrorRendering: true,
    }))
  })

  it('caches per app while keeping separate app initialization state', async () => {
    const firstPlugin = await createPluginFor({}, { loader: { init: { theme: 'forest' } } })
    const secondPlugin = await createPluginFor({}, { loader: { init: { theme: 'neutral' } } })

    await Promise.all([
      firstPlugin.provide.mermaid(),
      firstPlugin.provide.mermaid(),
    ])
    await secondPlugin.provide.mermaid()

    expect(initialize).toHaveBeenCalledTimes(2)
    expect(initialize).toHaveBeenNthCalledWith(1, expect.objectContaining({ theme: 'forest' }))
    expect(initialize).toHaveBeenNthCalledWith(2, expect.objectContaining({ theme: 'neutral' }))
  })

  it('materializes a mutable working copy without mutating the snapshot', async () => {
    const nuxtApp = {}
    const plugin = await createPluginFor(nuxtApp, {
      loader: { init: { themeVariables: { primaryColor: 'blue' } } },
    })
    initialize.mockImplementationOnce((config: { themeVariables?: { primaryColor?: string } }) => {
      if (config.themeVariables) config.themeVariables.primaryColor = 'mutated'
    })

    await plugin.provide.mermaid()

    const init = getRuntimeMermaidSnapshot(nuxtApp).loader?.init as unknown as {
      themeVariables: { primaryColor: string }
    }
    expect(init.themeVariables.primaryColor).toBe('blue')
  })

  it('clears a failed app-local load so the next call can retry', async () => {
    const plugin = await createPluginFor({}, {})
    initialize.mockImplementationOnce(() => {
      throw new Error('initialization failed')
    })

    await expect(plugin.provide.mermaid()).rejects.toThrow('initialization failed')
    await expect(plugin.provide.mermaid()).resolves.toBe(mermaidInstance)
    expect(initialize).toHaveBeenCalledTimes(2)
  })
})
