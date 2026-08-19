import type { Mermaid, MermaidConfig } from 'mermaid'
import { afterEach, describe, expect, it, vi } from 'vitest'

function asMermaid(value: object): Mermaid {
  return value as Mermaid
}

class TestElement {
  readonly attributes = new Map<string, string>()
  readonly childNodes: TestElement[] = []
  readonly style: Record<string, string> = {}
  parentNode: TestElement | null = null
  inert = false
  tabIndex = 0

  constructor(
    readonly tagName: string,
    readonly ownerDocument: TestDocument,
    private readonly events: string[],
  ) {}

  get isConnected(): boolean {
    return this === this.ownerDocument.body || this.parentNode?.isConnected === true
  }

  get textContent() {
    return this.childNodes.map(node => node.textContent).join('')
  }

  set textContent(value: string) {
    this.replaceChildren()
    if (value) {
      const text = this.ownerDocument.createElement('#text')
      text.attributes.set('value', value)
      this.appendChild(text)
    }
    this.events.push(`write:${value}`)
  }

  get innerHTML() {
    return this.childNodes.map(node => `<${node.tagName}></${node.tagName}>`).join('')
  }

  set innerHTML(value: string) {
    this.replaceChildren()
    const tagName = value.includes('<iframe') ? 'iframe' : value.includes('<svg') ? 'svg' : undefined
    if (tagName)
      this.appendChild(this.ownerDocument.createElement(tagName))
    this.events.push(`html:${value}`)
  }

  appendChild(node: TestElement) {
    node.remove()
    node.parentNode = this
    this.childNodes.push(node)
    return node
  }

  append(...nodes: TestElement[]) {
    for (const node of nodes) this.appendChild(node)
  }

  removeChild(node: TestElement) {
    const index = this.childNodes.indexOf(node)
    if (index < 0) throw new Error('Node is not a child')
    this.childNodes.splice(index, 1)
    node.parentNode = null
    return node
  }

  replaceChildren(...nodes: TestElement[]) {
    for (const child of this.childNodes) child.parentNode = null
    this.childNodes.splice(0)
    this.append(...nodes)
    this.events.push(`replace:${nodes.map(node => node.tagName).join(',')}`)
  }

  remove() {
    if (!this.parentNode) return
    const index = this.parentNode.childNodes.indexOf(this)
    if (index >= 0) this.parentNode.childNodes.splice(index, 1)
    this.parentNode = null
  }

  contains(candidate: TestElement): boolean {
    return candidate === this || this.childNodes.some(child => child.contains(candidate))
  }

  querySelector(selector: string): TestElement | null {
    const tagName = selector.toLowerCase()
    for (const child of this.childNodes) {
      if (child.tagName === tagName) return child
      const descendant = child.querySelector(selector)
      if (descendant) return descendant
    }
    return null
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }

  hasAttribute(name: string) {
    return this.attributes.has(name)
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  getBBox() {
    return { x: 1, y: 2, width: 300, height: 200 }
  }
}

class TestDocument {
  readonly body: TestElement

  constructor(private readonly events: string[]) {
    this.body = new TestElement('body', this, events)
  }

  createElement(tagName: string) {
    return new TestElement(tagName.toLowerCase(), this, this.events)
  }
}

function createDomTarget(events: string[]) {
  const document = new TestDocument(events)
  const liveRoot = document.createElement('main')
  const target = document.createElement('div')
  const committed = document.createElement('svg')
  committed.setAttribute('data-committed', 'true')
  document.body.appendChild(liveRoot)
  liveRoot.appendChild(target)
  target.appendChild(committed)

  return { document, liveRoot, target, committed }
}

describe('createMermaidRenderer', () => {
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
    const beforeCommit = vi.fn()
    const readRenderData = vi.fn(() => ({
      source: 'graph TD; A-->B',
      config: {} satisfies MermaidConfig,
      target: null,
    }))

    const requestRender = createMermaidRenderer({
      loadMermaid,
      readRenderData,
      beforeCommit,
      debug: true,
    })

    expect(readRenderData).not.toHaveBeenCalled()
    expect(loadMermaid).not.toHaveBeenCalled()
    expect(beforeCommit).not.toHaveBeenCalled()

    await expect(requestRender()).resolves.toEqual({ status: 'skipped' })
    expect(readRenderData).toHaveBeenCalledOnce()
    expect(loadMermaid).not.toHaveBeenCalled()
    expect(beforeCommit).not.toHaveBeenCalled()
  })

  it('skips an empty source before commit preparation or Mermaid loading', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const loadMermaid = vi.fn()
    const beforeCommit = vi.fn()
    const readRenderData = vi.fn(() => ({
      source: '',
      config: {} satisfies MermaidConfig,
      target: {} as HTMLDivElement,
    }))

    const requestRender = createMermaidRenderer({
      loadMermaid,
      readRenderData,
      beforeCommit,
      debug: false,
    })

    await expect(requestRender()).resolves.toEqual({ status: 'skipped' })
    expect(loadMermaid).not.toHaveBeenCalled()
    expect(beforeCommit).not.toHaveBeenCalled()
  })

  it('stages a valid Render Attempt offscreen and commits it in one live replacement', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    const config = { theme: 'dark' } satisfies MermaidConfig
    const { document, liveRoot, target, committed } = createDomTarget(events)
    let finishRender!: (value: { svg: string }) => void
    const renderResult = new Promise<{ svg: string }>((resolve) => {
      finishRender = resolve
    })
    const mermaid = asMermaid({
      initialize: vi.fn((receivedConfig: MermaidConfig) => {
        expect(receivedConfig).toBe(config)
        events.push('initialize')
      }),
      render: vi.fn(async (_id, source, stagingTarget) => {
        expect(source).toBe('graph TD; A-->B')
        expect(stagingTarget).not.toBe(target)
        const stagingElement = stagingTarget as unknown as TestElement
        const stagingRoot = stagingElement.parentNode
        expect(stagingElement.isConnected).toBe(true)
        expect(liveRoot.contains(stagingElement)).toBe(false)
        expect(stagingRoot?.getAttribute('aria-hidden')).toBe('true')
        expect(stagingRoot?.inert).toBe(true)
        expect(stagingRoot?.tabIndex).toBe(-1)
        expect(stagingRoot?.style.pointerEvents).toBe('none')
        expect(stagingRoot?.style.opacity).toBe('0')
        events.push('render')
        return renderResult
      }),
    })
    const requestRender = createMermaidRenderer({
      readRenderData: () => {
        events.push('read')
        return { source: 'graph TD; A-->B', config, target: target as unknown as HTMLDivElement }
      },
      beforeCommit: () => {
        events.push('beforeCommit')
      },
      loadMermaid: async () => {
        events.push('load')
        return mermaid
      },
      debug: false,
    })

    const outcome = requestRender()
    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce())
    expect(target.childNodes).toEqual([committed])

    finishRender({ svg: '<svg data-staged="true"></svg>' })
    await expect(outcome).resolves.toEqual({
      status: 'success',
      source: 'graph TD; A-->B',
      config,
    })

    expect(target.childNodes.map(node => node.tagName)).toEqual(['svg'])
    expect(target.childNodes[0]).not.toBe(committed)
    expect(events.indexOf('beforeCommit')).toBeLessThan(events.lastIndexOf('replace:svg'))
    expect(document.body.childNodes).toEqual([liveRoot])
  })

  it.each([
    ['strict SVG', '<svg data-security="strict"></svg>', 'svg'],
    ['sandbox iframe', '<iframe data-security="sandbox"></iframe>', 'iframe'],
  ])('moves committed %s nodes from staging without reparsing', async (_label, output, expectedTag) => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    const { target } = createDomTarget(events)
    let boundNode: TestElement | undefined
    const requestRender = createMermaidRenderer({
      readRenderData: () => ({
        source: 'source',
        config: {},
        target: target as unknown as HTMLDivElement,
      }),
      beforeCommit: () => {},
      loadMermaid: async () => asMermaid({
        initialize: vi.fn(),
        render: vi.fn(async () => ({
          svg: output,
          bindFunctions: (stagingTarget: Element) => {
            boundNode = (stagingTarget as unknown as TestElement).childNodes[0]
          },
        })),
      }),
      debug: false,
    })

    await expect(requestRender()).resolves.toEqual({
      status: 'success',
      source: 'source',
      config: {},
    })
    expect(target.childNodes).toEqual([boundNode])
    expect(target.childNodes[0]?.tagName).toBe(expectedTag)
  })

  it('skips a stale queued Render Request before reading data or loading Mermaid', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    let releaseBlocker!: (value: { svg: string }) => void
    let markBlockerStarted!: () => void
    const blockerStarted = new Promise<void>((resolve) => {
      markBlockerStarted = resolve
    })
    const blockerGate = new Promise<{ svg: string }>((resolve) => {
      releaseBlocker = resolve
    })
    const blockerTarget = createDomTarget(events).target
    const latestTarget = createDomTarget(events).target

    const blockerRequester = createMermaidRenderer({
      readRenderData: () => ({ source: 'blocker source', config: {}, target: blockerTarget as unknown as HTMLDivElement }),
      beforeCommit: () => {},
      loadMermaid: async () => asMermaid({
        initialize: vi.fn(),
        render: vi.fn(async () => {
          markBlockerStarted()
          return blockerGate
        }),
      }),
      debug: false,
    })
    const readRenderData = vi.fn(() => ({
      source: 'latest source',
      config: { theme: 'forest' } satisfies MermaidConfig,
      target: latestTarget as unknown as HTMLDivElement,
    }))
    const initialize = vi.fn()
    const render = vi.fn(async () => ({ svg: '<svg data-source="latest"></svg>' }))
    const loadMermaid = vi.fn(async () => asMermaid({ initialize, render }))
    const requestRender = createMermaidRenderer({
      readRenderData,
      beforeCommit: () => {},
      loadMermaid,
      debug: false,
    })

    const blockerOutcome = blockerRequester()
    await blockerStarted
    const staleOutcome = requestRender()
    const latestOutcome = requestRender()

    releaseBlocker({ svg: '<svg></svg>' })
    await expect(Promise.all([blockerOutcome, staleOutcome, latestOutcome])).resolves.toEqual([
      { status: 'success', source: 'blocker source', config: {} },
      { status: 'stale' },
      { status: 'success', source: 'latest source', config: { theme: 'forest' } },
    ])
    expect(readRenderData).toHaveBeenCalledOnce()
    expect(loadMermaid).toHaveBeenCalledOnce()
    expect(initialize).toHaveBeenCalledOnce()
    expect(render).toHaveBeenCalledOnce()
  })

  it('discards an executing Render Attempt that becomes stale before commit', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    const { target, committed } = createDomTarget(events)
    let source = 'old source'
    let finishOld!: (value: { svg: string }) => void
    let finishLatest!: (value: { svg: string }) => void
    const oldGate = new Promise<{ svg: string }>((resolve) => {
      finishOld = resolve
    })
    const latestGate = new Promise<{ svg: string }>((resolve) => {
      finishLatest = resolve
    })
    const render = vi.fn()
      .mockImplementationOnce(async () => oldGate)
      .mockImplementationOnce(async () => latestGate)
    const beforeCommit = vi.fn()
    const requestRender = createMermaidRenderer({
      readRenderData: () => ({
        source,
        config: {},
        target: target as unknown as HTMLDivElement,
      }),
      beforeCommit,
      loadMermaid: async () => asMermaid({ initialize: vi.fn(), render }),
      debug: false,
    })

    const staleOutcome = requestRender()
    await vi.waitFor(() => expect(render).toHaveBeenCalledOnce())
    source = 'latest source'
    const latestOutcome = requestRender()

    finishOld({ svg: '<svg data-source="old"></svg>' })
    await expect(staleOutcome).resolves.toEqual({ status: 'stale' })
    expect(beforeCommit).not.toHaveBeenCalled()
    expect(target.childNodes).toEqual([committed])

    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(2))
    finishLatest({ svg: '<svg data-source="latest"></svg>' })
    await expect(latestOutcome).resolves.toEqual({
      status: 'success',
      source: 'latest source',
      config: {},
    })
    expect(beforeCommit).toHaveBeenCalledOnce()
    expect(target.childNodes[0]).not.toBe(committed)
  })

  it('classifies a failure from an invalidated Render Attempt as stale', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    const { target, committed } = createDomTarget(events)
    const staleFailure = new Error('stale failure')
    let rejectStale!: (reason: unknown) => void
    let finishLatest!: (value: { svg: string }) => void
    const staleGate = new Promise<{ svg: string }>((_resolve, reject) => {
      rejectStale = reject
    })
    const latestGate = new Promise<{ svg: string }>((resolve) => {
      finishLatest = resolve
    })
    const render = vi.fn()
      .mockImplementationOnce(async () => staleGate)
      .mockImplementationOnce(async () => latestGate)
    const beforeCommit = vi.fn()
    const requestRender = createMermaidRenderer({
      readRenderData: () => ({
        source: 'source',
        config: {},
        target: target as unknown as HTMLDivElement,
      }),
      beforeCommit,
      loadMermaid: async () => asMermaid({ initialize: vi.fn(), render }),
      debug: false,
    })

    const staleOutcome = requestRender()
    await vi.waitFor(() => expect(render).toHaveBeenCalledOnce())
    const latestOutcome = requestRender()
    rejectStale(staleFailure)

    await expect(staleOutcome).resolves.toEqual({ status: 'stale' })
    expect(target.childNodes).toEqual([committed])
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(2))
    finishLatest({ svg: '<svg data-source="latest"></svg>' })
    await expect(latestOutcome).resolves.toEqual({
      status: 'success',
      source: 'source',
      config: {},
    })
    expect(beforeCommit).toHaveBeenCalledOnce()
  })

  it('falls back to parent removal when staging root cleanup throws', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    const { document, liveRoot, target } = createDomTarget(events)
    const originalCreateElement = document.createElement.bind(document)
    let stagingRoot: TestElement | undefined
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (!stagingRoot) {
        stagingRoot = element
        const remove = element.remove.bind(element)
        element.remove = () => {
          if (element.isConnected) throw new Error('cleanup failed')
          remove()
        }
      }
      return element
    })
    const requestRender = createMermaidRenderer({
      readRenderData: () => ({
        source: 'source',
        config: {},
        target: target as unknown as HTMLDivElement,
      }),
      beforeCommit: () => {},
      loadMermaid: async () => asMermaid({
        initialize: vi.fn(),
        render: vi.fn(async () => ({ svg: '<svg></svg>' })),
      }),
      debug: false,
    })

    await expect(requestRender()).resolves.toEqual({
      status: 'success',
      source: 'source',
      config: {},
    })
    expect(stagingRoot?.parentNode).toBeNull()
    expect(document.body.childNodes).toEqual([liveRoot])
  })

  it('logically invalidates an executing Render Attempt without physical cancellation', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const events: string[] = []
    const { target, committed } = createDomTarget(events)
    let finishRender!: (value: { svg: string }) => void
    const renderGate = new Promise<{ svg: string }>((resolve) => {
      finishRender = resolve
    })
    const beforeCommit = vi.fn()
    const render = vi.fn(async () => renderGate)
    const requestRender = createMermaidRenderer({
      readRenderData: () => ({
        source: 'source',
        config: {},
        target: target as unknown as HTMLDivElement,
      }),
      beforeCommit,
      loadMermaid: async () => asMermaid({ initialize: vi.fn(), render }),
      debug: false,
    })

    const outcome = requestRender()
    await vi.waitFor(() => expect(render).toHaveBeenCalledOnce())
    requestRender.invalidate()
    finishRender({ svg: '<svg></svg>' })

    await expect(outcome).resolves.toEqual({ status: 'stale' })
    expect(beforeCommit).not.toHaveBeenCalled()
    expect(target.childNodes).toEqual([committed])
  })

  it('preserves the Committed Diagram and cleans staging after every failure stage', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const stages = ['loader', 'initialize', 'render', 'binding', 'beforeCommit'] as const

    for (const stage of stages) {
      const events: string[] = []
      const thrownValue = { stage }
      const { document, liveRoot, target, committed } = createDomTarget(events)

      const requestRender = createMermaidRenderer({
        readRenderData: () => ({
          source: `${stage} source`,
          config: {},
          target: target as unknown as HTMLDivElement,
        }),
        beforeCommit: () => {
          if (stage === 'beforeCommit') throw thrownValue
        },
        loadMermaid: async () => {
          if (stage === 'loader') throw thrownValue

          return asMermaid({
            initialize: vi.fn(() => {
              if (stage === 'initialize') throw thrownValue
            }),
            render: vi.fn(async () => {
              if (stage === 'render') throw thrownValue
              return {
                svg: '<svg></svg>',
                bindFunctions: () => {
                  if (stage === 'binding') throw thrownValue
                },
              }
            }),
          })
        },
        debug: false,
      })

      const outcome = await requestRender()

      expect(outcome.status).toBe('failure')
      if (outcome.status === 'failure')
        expect(outcome.error).toBe(thrownValue)
      expect(target.childNodes).toEqual([committed])
      expect(document.body.childNodes).toEqual([liveRoot])
    }

    const recoveredTarget = createDomTarget([])
    const recoveredRequest = createMermaidRenderer({
      readRenderData: () => ({
        source: 'recovered',
        config: {},
        target: recoveredTarget.target as unknown as HTMLDivElement,
      }),
      beforeCommit: () => {},
      loadMermaid: async () => asMermaid({
        initialize: vi.fn(),
        render: vi.fn(async () => ({ svg: '<svg></svg>' })),
      }),
      debug: false,
    })

    await expect(recoveredRequest()).resolves.toEqual({
      status: 'success',
      source: 'recovered',
      config: {},
    })
    expect(recoveredTarget.target.childNodes[0]).not.toBe(recoveredTarget.committed)
  })

  it('reports debug diagnostics by semantic event category', async () => {
    const { createMermaidRenderer } = await import('../src/runtime/mermaid-rendering')
    const thrownValue = new Error('debug failure')
    const { target } = createDomTarget([])
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('performance', {
      now: vi.fn()
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(125),
    })
    const requestRender = createMermaidRenderer({
      readRenderData: () => ({
        source: 'debug source',
        config: {},
        target: target as unknown as HTMLDivElement,
      }),
      beforeCommit: () => {},
      loadMermaid: async () => asMermaid({
        initialize: vi.fn(),
        render: vi.fn(async () => {
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
      'renderer:create',
      'queue:enqueue',
      'queue:start',
      'attempt:duration',
      'attempt:failure',
      'queue:finish',
    ]))
    expect(errorSpy.mock.calls.some(call => call.includes(thrownValue))).toBe(true)
  })
})
