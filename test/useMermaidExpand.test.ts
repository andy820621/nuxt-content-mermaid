import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useMermaidExpand } from '../src/runtime/composables/useMermaidExpand'

type ListenerMap = Map<string, Set<(event: Event) => void>>

const createListenerRegistry = () => {
  const listeners: ListenerMap = new Map()
  const add = vi.fn((event: string, handler: (event: Event) => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event)?.add(handler)
  })
  const remove = vi.fn((event: string, handler: (event: Event) => void) => {
    listeners.get(event)?.delete(handler)
  })
  const get = (event: string) => Array.from(listeners.get(event) ?? [])
  return { add, remove, get }
}

const createSvgStub = (rect: { top: number, left: number, width: number, height: number }) => {
  const createNode = () => ({
    id: '',
    style: {} as Record<string, string>,
    getBoundingClientRect: () => rect,
    cloneNode: () => createNode(),
    querySelectorAll: vi.fn(() => []),
    removeAttribute: vi.fn(),
    hasAttribute: vi.fn(() => false),
  })
  return createNode()
}

const createWrapStub = () => {
  return {
    nodeType: 1,
    textContent: '',
    style: {} as Record<string, string>,
    children: [] as unknown[],
    appendChild(child: unknown) {
      this.children.push(child)
    },
    contains(target: unknown) {
      return this.children.includes(target)
    },
  }
}

const createBrowserStubs = () => {
  const windowListeners = createListenerRegistry()
  const documentListeners = createListenerRegistry()
  const documentElementStyle = { overflow: 'visible', width: '120px', userSelect: '' }
  const bodyStyle = { overflow: 'auto', width: '80px', userSelect: '' }
  const stubDocument = {
    addEventListener: documentListeners.add,
    removeEventListener: documentListeners.remove,
    documentElement: { style: documentElementStyle, clientWidth: 1000 },
    body: { style: bodyStyle, offsetHeight: 0 },
  }
  const stubWindow = {
    innerWidth: 1000,
    innerHeight: 800,
    addEventListener: windowListeners.add,
    removeEventListener: windowListeners.remove,
    getComputedStyle: vi.fn(() => ({ transitionDuration: '0s' })),
    document: stubDocument,
  }

  vi.stubGlobal('window', stubWindow)
  vi.stubGlobal('document', stubDocument)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())

  return { windowListeners, documentListeners, stubDocument }
}

const openExpand = async (expand: ReturnType<typeof useMermaidExpand>) => {
  expand.openExpand()
  await nextTick()
  await nextTick()
}

describe('useMermaidExpand', () => {
  let windowListeners: ReturnType<typeof createListenerRegistry>
  let documentListeners: ReturnType<typeof createListenerRegistry>

  beforeEach(() => {
    const stubs = createBrowserStubs()
    windowListeners = stubs.windowListeners
    documentListeners = stubs.documentListeners
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('expands and collapses with scroll lock', async () => {
    const svg = createSvgStub({ top: 10, left: 20, width: 200, height: 100 })
    const wrap = createWrapStub()
    const expand = useMermaidExpand({
      getExpandTarget: () => svg as unknown as SVGElement,
    })

    expand.setExpandTargetWrap(wrap as unknown as Element)

    await openExpand(expand)

    expect(expand.isExpandActive.value).toBe(true)
    expect(expand.isVisible.value).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')

    expand.closeExpand()
    expect(expand.isVisible.value).toBe(false)
    expand.handleExpandTransitionEnd({ propertyName: 'transform' } as TransitionEvent)

    expect(expand.isExpandActive.value).toBe(false)
    expect(document.body.style.overflow).toBe('auto')
    expect(document.documentElement.style.overflow).toBe('visible')
    expect(document.body.style.width).toBe('80px')
    expect(document.documentElement.style.width).toBe('120px')
  })

  it('closes on Escape keydown', async () => {
    const svg = createSvgStub({ top: 10, left: 20, width: 200, height: 100 })
    const wrap = createWrapStub()
    const expand = useMermaidExpand({
      getExpandTarget: () => svg as unknown as SVGElement,
    })

    expand.setExpandTargetWrap(wrap as unknown as Element)
    await openExpand(expand)

    const keydowns = documentListeners.get('keydown')
    const event = {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent

    keydowns.forEach(handler => handler(event as unknown as Event))
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
    expect(expand.isVisible.value).toBe(false)

    expand.handleExpandTransitionEnd({ propertyName: 'transform' } as TransitionEvent)
    expect(expand.isExpandActive.value).toBe(false)
  })

  it('closes on wheel outside the diagram', async () => {
    const svg = createSvgStub({ top: 10, left: 20, width: 200, height: 100 })
    const wrap = createWrapStub()
    const expand = useMermaidExpand({
      getExpandTarget: () => svg as unknown as SVGElement,
    })

    expand.setExpandTargetWrap(wrap as unknown as Element)
    await openExpand(expand)

    const wheel = windowListeners.get('wheel')[0]
    const event = {
      target: {},
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as WheelEvent

    wheel?.(event as unknown as Event)
    await new Promise(resolve => queueMicrotask(resolve))

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
    expect(expand.isVisible.value).toBe(false)

    expand.handleExpandTransitionEnd({ propertyName: 'transform' } as TransitionEvent)
    expect(expand.isExpandActive.value).toBe(false)
  })
})
