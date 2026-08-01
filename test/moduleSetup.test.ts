import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FileBeforeParseHook, ResolvedCollection } from '@nuxt/content'
import type { ModuleOptions } from '../src/module'

const addPlugin = vi.fn()
const addComponent = vi.fn()
const addTypeTemplate = vi.fn()
const addVitePlugin = vi.fn()
const addImports = vi.fn()
const loggerWarn = vi.fn()
const transformMarkdownDiagrams = vi.fn<(body: string) => string>()

vi.mock('@nuxt/kit', () => ({
  defineNuxtModule: (config: unknown) => config,
  createResolver: () => ({
    resolve: (...parts: string[]) => parts.join('/'),
  }),
  addPlugin,
  addComponent,
  addTypeTemplate,
  addVitePlugin,
  addImports,
  useLogger: () => ({
    warn: loggerWarn,
  }),
}))

vi.mock('../src/markdown-diagram-transform', () => ({
  transformMarkdownDiagrams,
}))

interface NuxtStub {
  options: { runtimeConfig: { public: Record<string, unknown> } }
  hook: (name: string, fn: (...args: unknown[]) => void) => void
}

function createNuxtStub() {
  const hooks: Record<string, Array<(...args: unknown[]) => void>> = {}
  const nuxt: NuxtStub = {
    options: { runtimeConfig: { public: {} } },
    hook: (name, fn) => {
      (hooks[name] ||= []).push(fn)
    },
  }

  return { nuxt, hooks }
}

function createFileCtx(id: string, body: string): FileBeforeParseHook {
  const collection = {} as ResolvedCollection
  const parserOptions = {} as FileBeforeParseHook['parserOptions']

  return {
    file: {
      id,
      path: id,
      body,
      collection: 'content',
    },
    collection,
    parserOptions,
  }
}

describe('module setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('skips registration when disabled', async () => {
    const mod = await import('../src/module')
    const moduleDef = mod.default as { setup?: (options: Partial<ModuleOptions>, nuxt: NuxtStub) => unknown }
    const { nuxt, hooks } = createNuxtStub()

    await moduleDef.setup?.({ enabled: false }, nuxt)

    expect(addPlugin).not.toHaveBeenCalled()
    expect(addComponent).not.toHaveBeenCalled()
    expect(addTypeTemplate).not.toHaveBeenCalled()
    expect(addVitePlugin).not.toHaveBeenCalled()
    expect(Object.keys(hooks)).toHaveLength(0)
  })

  it('registers module hooks', async () => {
    const mod = await import('../src/module')
    const moduleDef = mod.default as { setup?: (options: Partial<ModuleOptions>, nuxt: NuxtStub) => unknown }
    const { nuxt, hooks } = createNuxtStub()

    await moduleDef.setup?.({}, nuxt)

    expect(addPlugin).toHaveBeenCalled()
    expect(addComponent).toHaveBeenCalled()
    expect(addTypeTemplate).toHaveBeenCalled()
    expect(addVitePlugin).toHaveBeenCalledTimes(1)
    expect(hooks['content:file:beforeParse']).toHaveLength(1)

    const createOptimizeDepsPlugin = addVitePlugin.mock.calls[0]?.[0] as
      (() => { configEnvironment?: (name: string, config: Record<string, unknown>) => void })
      | undefined
    if (!createOptimizeDepsPlugin)
      throw new Error('optimizeDeps plugin not registered')

    const optimizeDepsPlugin = createOptimizeDepsPlugin()
    const clientConfig: Record<string, unknown> = {}

    optimizeDepsPlugin.configEnvironment?.('client', clientConfig)
    expect(clientConfig.optimizeDeps).toBeDefined()
    expect((clientConfig.optimizeDeps as { include?: string[] }).include).toEqual(
      expect.arrayContaining([
        '@barzhsieh/nuxt-content-mermaid > mermaid',
        '@barzhsieh/nuxt-content-mermaid > @braintree/sanitize-url',
        '@barzhsieh/nuxt-content-mermaid > dayjs',
        '@barzhsieh/nuxt-content-mermaid > dayjs/plugin/isoWeek.js',
        '@barzhsieh/nuxt-content-mermaid > dayjs/plugin/customParseFormat.js',
        '@barzhsieh/nuxt-content-mermaid > dayjs/plugin/advancedFormat.js',
        '@barzhsieh/nuxt-content-mermaid > dayjs/plugin/duration.js',
      ]),
    )

    const serverConfig: Record<string, unknown> = {}
    optimizeDepsPlugin.configEnvironment?.('server', serverConfig)
    expect(serverConfig.optimizeDeps).toBeUndefined()
  })

  it('delegates every Markdown body and writes back the exact transform result', async () => {
    const mod = await import('../src/module')
    const moduleDef = mod.default as { setup?: (options: Partial<ModuleOptions>, nuxt: NuxtStub) => unknown }
    const { nuxt, hooks } = createNuxtStub()
    const body = '# Original document'
    const transformedBody = '<!-- transform sentinel -->'

    transformMarkdownDiagrams.mockReturnValue(transformedBody)

    await moduleDef.setup?.({}, nuxt)

    const beforeParse = hooks['content:file:beforeParse']?.[0]
    if (!beforeParse)
      throw new Error('content:file:beforeParse hook not registered')

    const markdownCtx = createFileCtx('/test/sample.md', body)

    await beforeParse(markdownCtx)

    expect(transformMarkdownDiagrams).toHaveBeenCalledOnce()
    expect(transformMarkdownDiagrams).toHaveBeenCalledWith(body)
    expect(markdownCtx.file.body).toBe(transformedBody)
  })

  it('leaves non-Markdown bodies untouched without delegating', async () => {
    const mod = await import('../src/module')
    const moduleDef = mod.default as { setup?: (options: Partial<ModuleOptions>, nuxt: NuxtStub) => unknown }
    const { nuxt, hooks } = createNuxtStub()
    const body = 'opaque source'

    await moduleDef.setup?.({}, nuxt)

    const beforeParse = hooks['content:file:beforeParse']?.[0]
    if (!beforeParse)
      throw new Error('content:file:beforeParse hook not registered')

    const sourceCtx = createFileCtx('/test/source.txt', body)

    await beforeParse(sourceCtx)

    expect(transformMarkdownDiagrams).not.toHaveBeenCalled()
    expect(sourceCtx.file.body).toBe(body)
  })

  it('propagates unexpected transform failures', async () => {
    const mod = await import('../src/module')
    const moduleDef = mod.default as { setup?: (options: Partial<ModuleOptions>, nuxt: NuxtStub) => unknown }
    const { nuxt, hooks } = createNuxtStub()

    transformMarkdownDiagrams.mockImplementation(() => {
      throw new Error('unexpected transform failure')
    })

    await moduleDef.setup?.({}, nuxt)

    const beforeParse = hooks['content:file:beforeParse']?.[0]
    if (!beforeParse)
      throw new Error('content:file:beforeParse hook not registered')

    const markdownCtx = createFileCtx('/test/sample.md', '# Original document')

    expect(() => beforeParse(markdownCtx)).toThrow()
  })
})
