import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRuntimeConfig = {
  public: {
    contentMermaid: {},
  },
}

vi.mock('#app', () => ({
  defineNuxtPlugin: (fn: () => unknown) => fn(),
  useRuntimeConfig: () => mockRuntimeConfig,
}))

const initialize = vi.fn()

vi.mock('mermaid', () => ({
  default: {
    initialize,
  },
}))

describe('mermaid client plugin debug behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockRuntimeConfig.public.contentMermaid = {}
    // Clear cached loader between tests
    global.__nuxtMermaidLoader__ = undefined
  })

  it('applies debug-friendly defaults when enabled', async () => {
    mockRuntimeConfig.public.contentMermaid = { debug: true }

    const plugin = await import('../src/runtime/plugins/mermaid.client')
    // @ts-expect-error - accessing internal provide.mermaid for testing purposes
    await plugin.default.provide.mermaid()

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      logLevel: 1,
      suppressErrorRendering: false,
    }))
  })

  it('respects user init overrides even in debug mode', async () => {
    mockRuntimeConfig.public.contentMermaid = {
      debug: true,
      loader: { init: { logLevel: 3, suppressErrorRendering: true } },
    }

    const plugin = await import('../src/runtime/plugins/mermaid.client')
    // @ts-expect-error - accessing internal provide.mermaid for testing purposes
    await plugin.default.provide.mermaid()

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      logLevel: 3,
      suppressErrorRendering: true,
    }))
  })

  it('keeps suppressErrorRendering on when debug is disabled', async () => {
    mockRuntimeConfig.public.contentMermaid = { debug: false }

    const plugin = await import('../src/runtime/plugins/mermaid.client')
    // @ts-expect-error - accessing internal provide.mermaid for testing purposes
    await plugin.default.provide.mermaid()

    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      logLevel: 5,
      suppressErrorRendering: true,
    }))
  })
})
