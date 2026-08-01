import type { Mermaid, MermaidConfig } from 'mermaid'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { scheduler } = vi.hoisted(() => ({
  scheduler: { events: [] as string[] },
}))

vi.mock('vue', () => ({
  nextTick: vi.fn(async () => {
    scheduler.events.push('scheduler')
  }),
}))

function createTarget(events: string[], svg: SVGSVGElement | null = null) {
  let content = ''

  const target = {
    removeAttribute: vi.fn((name: string) => {
      events.push(`remove:${name}`)
    }),
    get textContent() {
      return content
    },
    set textContent(value: string | null) {
      content = value ?? ''
      events.push(`write:${content}`)
    },
    get innerHTML() {
      return content
    },
    set innerHTML(value: string) {
      content = value
      events.push(`html:${value}`)
    },
    querySelector: vi.fn((selector: string) => {
      events.push(`query:${selector}`)
      return svg
    }),
  } as unknown as HTMLDivElement

  return {
    target,
    readContent: () => content,
  }
}

function asMermaid(value: Pick<Mermaid, 'initialize' | 'run'>): Mermaid {
  return value as Mermaid
}

describe('createMermaidRenderer', () => {
  beforeEach(() => {
    scheduler.events = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('is safe to import and create on the server, then skips without a Render Target', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('SVGSVGElement', undefined)
    vi.stubGlobal('performance', undefined)

    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const loadMermaid = vi.fn()
    const prepare = vi.fn()
    const readRenderData = vi.fn(() => ({
      source: 'graph TD; A-->B',
      config: {} satisfies MermaidConfig,
      target: null,
    }))

    const requestRender = createMermaidRenderer({
      loadMermaid,
      readRenderData,
      prepare,
      debug: true,
    })

    expect(readRenderData).not.toHaveBeenCalled()
    expect(loadMermaid).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()

    await expect(requestRender()).resolves.toEqual({ status: 'skipped' })
    expect(readRenderData).toHaveBeenCalledOnce()
    expect(loadMermaid).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
  })

  it('skips an empty source before prepare or Mermaid loading', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const loadMermaid = vi.fn()
    const prepare = vi.fn()
    const readRenderData = vi.fn(() => ({
      source: '',
      config: {} satisfies MermaidConfig,
      target: {} as HTMLDivElement,
    }))

    const requestRender = createMermaidRenderer({
      loadMermaid,
      readRenderData,
      prepare,
      debug: false,
    })

    await expect(requestRender()).resolves.toEqual({ status: 'skipped' })
    expect(loadMermaid).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
  })

  it('follows the valid Render Attempt protocol and normalizes the SVG viewBox', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    scheduler.events = events
    const config = { theme: 'dark' } satisfies MermaidConfig
    const svg = {
      hasAttribute: vi.fn((name: string) => {
        events.push(`has:${name}`)
        return false
      }),
      getBBox: vi.fn(() => {
        events.push('bbox')
        return { x: 1, y: 2, width: 300, height: 200 }
      }),
      setAttribute: vi.fn((name: string, value: string) => {
        events.push(`set:${name}:${value}`)
      }),
    } as unknown as SVGSVGElement
    const { target } = createTarget(events, svg)
    const mermaid = asMermaid({
      initialize: vi.fn((receivedConfig: MermaidConfig) => {
        expect(receivedConfig).toBe(config)
        events.push('initialize')
      }),
      run: vi.fn(async (options) => {
        expect(options).toEqual({ nodes: [target], suppressErrors: true })
        events.push('run')
      }),
    })
    const requestRender = createMermaidRenderer({
      readRenderData: () => {
        events.push('read')
        return { source: 'graph TD; A-->B', config, target }
      },
      prepare: () => {
        events.push('prepare')
      },
      loadMermaid: async () => {
        events.push('load')
        return mermaid
      },
      debug: false,
    })

    const outcome = await requestRender()
    events.push(outcome.status)

    expect(events).toEqual([
      'read',
      'prepare',
      'load',
      'initialize',
      'remove:data-processed',
      'write:graph TD; A-->B',
      'scheduler',
      'run',
      'query:svg',
      'has:viewBox',
      'bbox',
      'set:viewBox:1 2 300 200',
      'success',
    ])
  })

  it('shares one FIFO and reads each requester data only when dequeued', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    let releaseFirst!: () => void
    let markFirstStarted!: () => void
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve
    })
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const firstTarget = createTarget(events).target
    const oldTarget = createTarget(events)
    const latestTarget = createTarget(events)
    const oldConfig = { theme: 'default' } satisfies MermaidConfig
    const latestConfig = { theme: 'forest' } satisfies MermaidConfig
    let secondData = {
      source: 'old source',
      config: oldConfig as MermaidConfig,
      target: oldTarget.target,
    }

    const firstRequester = createMermaidRenderer({
      readRenderData: () => ({ source: 'first source', config: {}, target: firstTarget }),
      prepare: () => {},
      loadMermaid: async () => asMermaid({
        initialize: vi.fn(),
        run: vi.fn(async () => {
          events.push('first:start')
          markFirstStarted()
          await firstGate
          events.push('first:finish')
        }),
      }),
      debug: false,
    })
    const secondRead = vi.fn(() => secondData)
    const secondInitialize = vi.fn()
    const secondRequester = createMermaidRenderer({
      readRenderData: secondRead,
      prepare: () => {},
      loadMermaid: async () => asMermaid({
        initialize: secondInitialize,
        run: vi.fn(async () => {
          events.push('second')
        }),
      }),
      debug: false,
    })

    const firstOutcome = firstRequester()
    await firstStarted
    const secondOutcome = secondRequester()
    secondData = {
      source: 'latest source',
      config: latestConfig,
      target: latestTarget.target,
    }

    await Promise.resolve()
    expect(secondRead).not.toHaveBeenCalled()

    releaseFirst()
    await expect(Promise.all([firstOutcome, secondOutcome])).resolves.toEqual([
      { status: 'success' },
      { status: 'success' },
    ])
    expect(events.indexOf('first:finish')).toBeLessThan(events.indexOf('second'))
    expect(secondInitialize).toHaveBeenCalledWith(latestConfig)
    expect(oldTarget.readContent()).toBe('')
    expect(latestTarget.readContent()).toBe('latest source')
  })

  it('preserves failures from every attempt stage, clears the target, and recovers the FIFO', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const stages = ['prepare', 'loader', 'initialize', 'run', 'normalization'] as const

    for (const stage of stages) {
      const events: string[] = []
      const thrownValue = { stage }
      const { target } = createTarget(events)

      if (stage === 'normalization') {
        target.querySelector = vi.fn(() => {
          throw thrownValue
        })
      }

      const requestRender = createMermaidRenderer({
        readRenderData: () => ({ source: `${stage} source`, config: {}, target }),
        prepare: () => {
          if (stage === 'prepare') throw thrownValue
        },
        loadMermaid: async () => {
          if (stage === 'loader') throw thrownValue

          return asMermaid({
            initialize: vi.fn(() => {
              if (stage === 'initialize') throw thrownValue
            }),
            run: vi.fn(async () => {
              if (stage === 'run') throw thrownValue
            }),
          })
        },
        debug: false,
      })

      const outcome = await requestRender()

      expect(outcome.status).toBe('failure')
      if (outcome.status === 'failure')
        expect(outcome.error).toBe(thrownValue)
      expect(events).toContain('html:')
    }

    const recoveredTarget = createTarget([])
    const recoveredRequest = createMermaidRenderer({
      readRenderData: () => ({ source: 'recovered', config: {}, target: recoveredTarget.target }),
      prepare: () => {},
      loadMermaid: async () => asMermaid({ initialize: vi.fn(), run: vi.fn() }),
      debug: false,
    })

    await expect(recoveredRequest()).resolves.toEqual({ status: 'success' })
    expect(recoveredTarget.readContent()).toBe('recovered')
  })

  it('reports debug diagnostics by semantic event category', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const thrownValue = new Error('debug failure')
    const { target } = createTarget([])
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('performance', {
      now: vi.fn()
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(125),
    })
    const requestRender = createMermaidRenderer({
      readRenderData: () => ({ source: 'debug source', config: {}, target }),
      prepare: () => {},
      loadMermaid: async () => asMermaid({
        initialize: vi.fn(),
        run: vi.fn(async () => {
          throw thrownValue
        }),
      }),
      debug: true,
    })

    const outcome = await requestRender()
    const diagnosticEvents = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .flatMap(call => call)
      .filter((value): value is { event: string } => (
        typeof value === 'object'
        && value !== null
        && 'event' in value
        && typeof value.event === 'string'
      ))
      .map(value => value.event)

    expect(outcome.status).toBe('failure')
    if (outcome.status === 'failure')
      expect(outcome.error).toBe(thrownValue)
    expect(diagnosticEvents).toEqual(expect.arrayContaining([
      'queue:enqueue',
      'queue:start',
      'attempt:duration',
      'attempt:failure',
      'queue:finish',
    ]))
    expect(errorSpy.mock.calls.some(call => call.includes(thrownValue))).toBe(true)
  })
})
