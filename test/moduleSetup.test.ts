import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FileBeforeParseHook, ResolvedCollection } from '@nuxt/content'
import type { ModuleOptions } from '../src/module'

const addPlugin = vi.fn()
const addComponent = vi.fn()
const addTypeTemplate = vi.fn()
const loggerWarn = vi.fn()

vi.mock('@nuxt/kit', () => ({
  defineNuxtModule: (config: unknown) => config,
  createResolver: () => ({
    resolve: (...parts: string[]) => parts.join('/'),
  }),
  addPlugin,
  addComponent,
  addTypeTemplate,
  useLogger: () => ({
    warn: loggerWarn,
  }),
}))

interface NuxtStub {
  options: { runtimeConfig: { public: Record<string, unknown> } }
  hook: (name: string, fn: (ctx: FileBeforeParseHook) => void) => void
}

function createNuxtStub() {
  const hooks: Record<string, Array<(ctx: FileBeforeParseHook) => void>> = {}
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
    expect(Object.keys(hooks)).toHaveLength(0)
  })

  it('registers hooks and transforms only markdown files with content', async () => {
    const mod = await import('../src/module')
    const moduleDef = mod.default as { setup?: (options: Partial<ModuleOptions>, nuxt: NuxtStub) => unknown }
    const { nuxt, hooks } = createNuxtStub()

    await moduleDef.setup?.({}, nuxt)

    expect(addPlugin).toHaveBeenCalled()
    expect(addComponent).toHaveBeenCalled()
    expect(addTypeTemplate).toHaveBeenCalled()
    expect(hooks['content:file:beforeParse']).toHaveLength(1)

    const beforeParse = hooks['content:file:beforeParse']?.[0]
    if (!beforeParse)
      throw new Error('content:file:beforeParse hook not registered')

    const markdownCtx = createFileCtx(
      '/test/sample.md',
      [
        '# Title',
        '```mermaid',
        'A --> B',
        '```',
        '',
        '```mermaid',
        'B --> C',
        '```',
      ].join('\n'),
    )

    await beforeParse(markdownCtx)

    const matches = markdownCtx.file.body?.match(/<Mermaid :config="config" code="/g) || []
    expect(matches.length).toBe(2)

    const nonMarkdownCtx = createFileCtx(
      '/test/sample.txt',
      '```mermaid\nA --> B\n```',
    )

    await beforeParse(nonMarkdownCtx)
    expect(nonMarkdownCtx.file.body).toBe('```mermaid\nA --> B\n```')

    const emptyDiagramCtx = createFileCtx(
      '/test/empty.md',
      '```mermaid\n   \n```',
    )

    await beforeParse(emptyDiagramCtx)
    expect(emptyDiagramCtx.file.body).toBe('```mermaid\n   \n```')
  })
})
