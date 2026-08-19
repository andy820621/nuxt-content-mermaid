import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useMermaidExpand } from '../src/runtime/composables/useMermaidExpand'
import { DEFAULT_EXPAND_OPTIONS } from '../src/runtime/constants'
import type { ExpandOptions } from '../src/runtime/types/expand'

type Listener = (event: Event) => void

function createEventTarget<T extends Record<string, unknown>>(extra: T = {} as T) {
  const listeners = new Map<string, Set<Listener>>()
  return {
    ...extra,
    addEventListener: vi.fn((type: string, listener: Listener) => {
      const handlers = listeners.get(type) ?? new Set<Listener>()
      handlers.add(listener)
      listeners.set(type, handlers)
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => listeners.get(type)?.delete(listener)),
    dispatch(type: string, event: Record<string, unknown> = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event as unknown as Event)
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0
    },
  }
}

function createSvgStub(rect: { top: number, left: number, width: number, height: number }) {
  const createNode = (): Record<string, unknown> => ({
    id: '',
    style: {},
    getBoundingClientRect: () => rect,
    cloneNode: () => createNode(),
    querySelectorAll: vi.fn(() => []),
    removeAttribute: vi.fn(),
    hasAttribute: vi.fn(() => false),
    contains: vi.fn((target: unknown) => target === svg),
  })
  const svg = createNode()
  return svg
}

function createViewportStub(
  rect: { top: number, left: number, width: number, height: number },
  scrollLeft = 0,
) {
  return {
    nodeType: 1,
    clientLeft: 0,
    clientTop: 0,
    clientWidth: rect.width,
    clientHeight: rect.height,
    scrollLeft,
    scrollTop: 0,
    getBoundingClientRect: () => rect,
  }
}

function createElement(className = '') {
  const children: unknown[] = []
  let textContent = ''
  const element = createEventTarget({
    nodeType: 1,
    isConnected: true,
    hidden: false,
    style: {} as Record<string, string>,
    children,
    classList: { contains: (name: string) => className.split(' ').includes(name) },
    focus: vi.fn(),
    getAttribute: () => null,
    getClientRects: () => [{ width: 20, height: 20 }],
    querySelectorAll: () => [],
    appendChild(child: unknown) {
      children.push(child)
    },
    contains(target: unknown) {
      return children.includes(target)
    },
  })
  Object.defineProperty(element, 'textContent', {
    get: () => textContent,
    set: (value: string) => {
      textContent = value
      if (value === '') children.splice(0)
    },
  })
  return element as typeof element & { textContent: string }
}

function createBrowser() {
  let rafId = 0
  let transitionDuration = '0s'
  const rafs = new Map<number, FrameRequestCallback>()
  const rafHistory: FrameRequestCallback[] = []
  const viewportState = { width: 1000, height: 800, gutter: 20 }
  const visualViewport = createEventTarget({ width: viewportState.width, height: viewportState.height, scale: 1 })
  const documentElement = {
    style: { overflow: 'visible', width: '120px', userSelect: 'text' },
    clientHeight: viewportState.height,
    scrollHeight: 1200,
  }
  Object.defineProperty(documentElement, 'clientWidth', {
    get: () => documentElement.style.overflow === 'hidden'
      ? viewportState.width
      : viewportState.width - viewportState.gutter,
  })
  const body = { style: { overflow: 'auto', width: '80px', userSelect: 'text' }, offsetHeight: 0 }
  const documentTarget = createEventTarget({ documentElement, body })
  const windowTarget = createEventTarget({
    innerWidth: viewportState.width,
    innerHeight: viewportState.height,
    visualViewport,
    document: documentTarget,
    getComputedStyle: vi.fn(() => ({ transitionDuration })),
  })

  vi.stubGlobal('document', documentTarget)
  vi.stubGlobal('window', windowTarget)
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    const id = ++rafId
    rafs.set(id, callback)
    rafHistory.push(callback)
    return id
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => rafs.delete(id)))

  return {
    documentTarget,
    windowTarget,
    visualViewport,
    rafHistory,
    setTransitionDuration(value: string) {
      transitionDuration = value
    },
    resizeViewport(width: number, height: number, scrollHeight: number) {
      viewportState.width = width
      viewportState.height = height
      windowTarget.innerWidth = width
      windowTarget.innerHeight = height
      visualViewport.width = width
      visualViewport.height = height
      documentElement.clientHeight = height
      documentElement.scrollHeight = scrollHeight
    },
    flushRafs() {
      const pending = [...rafs.entries()]
      rafs.clear()
      pending.forEach(([, callback]) => callback(0))
    },
  }
}

function setupExpand(
  options: ExpandOptions = DEFAULT_EXPAND_OPTIONS,
  geometry: {
    svg?: { top: number, left: number, width: number, height: number }
    viewport?: { top: number, left: number, width: number, height: number }
    scrollLeft?: number
  } = {},
  getInitialFocusTarget?: () => HTMLElement | null,
  getReturnFocusTarget?: () => HTMLElement | null,
) {
  const svg = createSvgStub(geometry.svg ?? { top: 10, left: 20, width: 200, height: 100 })
  const viewport = createViewportStub(
    geometry.viewport ?? { top: 0, left: 0, width: 1000, height: 800 },
    geometry.scrollLeft,
  )
  const target = createElement('ncm-expand-target')
  const modal = createElement('ncm-expand-modal')
  const blocked = ref(false)
  const expand = useMermaidExpand({
    getExpandTarget: () => svg as unknown as SVGElement,
    getExpandViewport: () => viewport as unknown as HTMLElement,
    expandOptions: options,
    isBlocked: blocked,
    getInitialFocusTarget,
    getReturnFocusTarget,
  })
  expand.setExpandTargetWrap(target as unknown as Element)
  expand.setExpandModal(modal as unknown as Element)
  return { expand, svg, viewport, target, modal, blocked }
}

async function openExpand(expand: ReturnType<typeof useMermaidExpand>, browser: ReturnType<typeof createBrowser>) {
  expand.toggle()
  await nextTick()
  browser.flushRafs()
  await nextTick()
  browser.flushRafs()
  await nextTick()
}

function finishClose(target: ReturnType<typeof createElement>) {
  target.dispatch('transitionend', { propertyName: 'transform' })
}

describe('useMermaidExpand', () => {
  let browser: ReturnType<typeof createBrowser>

  beforeEach(() => {
    vi.useFakeTimers()
    browser = createBrowser()
  })

  it('focuses the dialog when the close button is disabled', async () => {
    const options: ExpandOptions = {
      ...DEFAULT_EXPAND_OPTIONS,
      invokeCloseOn: {
        ...DEFAULT_EXPAND_OPTIONS.invokeCloseOn,
        closeButtonClick: false,
      },
    }
    const ctx = setupExpand(options, {}, () => null)

    ctx.expand.toggle()
    await nextTick()

    expect(ctx.modal.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('restores toolbar focus after the expand overlay closes', async () => {
    const trigger = {
      tagName: 'BUTTON',
      isConnected: true,
      hidden: false,
      disabled: false,
      getAttribute: () => null,
      getClientRects: () => [{ width: 20, height: 20 }],
      focus: vi.fn(),
    }
    const ctx = setupExpand(DEFAULT_EXPAND_OPTIONS, {}, undefined, () => trigger as unknown as HTMLElement)

    ctx.expand.toggle({ currentTarget: trigger } as unknown as Event)
    await nextTick()
    ctx.expand.toggle()
    finishClose(ctx.target)
    await nextTick()

    expect(trigger.focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('opens with a fitted SVG clone and scroll lock, then restores the page after close', async () => {
    const { expand, target } = setupExpand()

    await openExpand(expand, browser)

    expect(expand.isExpandActive.value).toBe(true)
    expect(expand.isVisible.value).toBe(true)
    expect(target.children).toHaveLength(1)
    expect(expand.expandTargetStyle.value.transform).toContain('scale(4.9)')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('hidden')

    expand.toggle()
    finishClose(target)

    expect(expand.isExpandActive.value).toBe(false)
    expect(target.children).toHaveLength(0)
    expect(target.textContent).toBe('')
    expect(document.body.style).toMatchObject({ overflow: 'auto', width: '80px' })
    expect(document.documentElement.style).toMatchObject({ overflow: 'visible', width: '120px' })
  })

  it('keeps the visible source slice in one viewport coordinate plane while opening', async () => {
    const ctx = setupExpand(DEFAULT_EXPAND_OPTIONS, {
      svg: { top: 100, left: -748, width: 1348, height: 240 },
      viewport: { top: 100, left: 300, width: 300, height: 240 },
      scrollLeft: 1048,
    })

    ctx.expand.toggle()
    await nextTick()

    expect(ctx.expand.expandClipStyle.value).toMatchObject({
      top: '0px',
      left: '0px',
      width: '980px',
      height: '800px',
      clipPath: 'inset(100px 380px 460px 300px)',
    })
    expect(ctx.expand.expandTargetStyle.value).toMatchObject({
      top: '100px',
      left: '-748px',
      width: '1348px',
      height: '240px',
      transform: 'translate(0px, 0px) scale(1)',
    })

    browser.flushRafs()
    await nextTick()
    browser.flushRafs()
    await nextTick()

    expect(ctx.expand.expandClipStyle.value.clipPath).toBe('inset(0px 0px 0px 0px)')
    expect(ctx.expand.expandTargetStyle.value).toMatchObject({
      top: '100px',
      left: '-748px',
    })
  })

  it('closes a horizontally scrolled diagram into its visible source slice', async () => {
    const ctx = setupExpand(DEFAULT_EXPAND_OPTIONS, {
      svg: { top: 100, left: -748, width: 1348, height: 240 },
      viewport: { top: 100, left: 300, width: 300, height: 240 },
      scrollLeft: 1048,
    })

    ctx.expand.toggle()
    await nextTick()

    expect(ctx.expand.expandClipStyle.value).toMatchObject({
      top: '0px',
      left: '0px',
      width: '980px',
      height: '800px',
      clipPath: 'inset(100px 380px 460px 300px)',
    })
    expect(ctx.expand.expandTargetStyle.value).toMatchObject({
      top: '100px',
      left: '-748px',
      width: '1348px',
      height: '240px',
      transform: 'translate(0px, 0px) scale(1)',
    })

    browser.flushRafs()
    ctx.expand.toggle()

    expect(ctx.expand.expandClipStyle.value.clipPath).toBe('inset(100px 380px 460px 300px)')
    expect(ctx.expand.expandTargetStyle.value.left).toBe('-748px')
    expect(ctx.viewport.scrollLeft).toBe(1048)
  })

  it.each([
    ['Escape', (_ctx: ReturnType<typeof setupExpand>) => browser.documentTarget.dispatch('keydown', { key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() })],
    ['outside wheel', (_ctx: ReturnType<typeof setupExpand>) => browser.windowTarget.dispatch('wheel', { target: {}, ctrlKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })],
    ['swipe', (_ctx: ReturnType<typeof setupExpand>) => {
      browser.windowTarget.dispatch('touchstart', { touches: [{}], changedTouches: [{ screenY: 10 }] })
      browser.windowTarget.dispatch('touchmove', { touches: [{}], changedTouches: [{ screenY: 30 }] })
    }],
    ['overlay click', (ctx: ReturnType<typeof setupExpand>) => ctx.modal.dispatch('click', { target: ctx.modal, stopPropagation: vi.fn() })],
    ['close button', (ctx: ReturnType<typeof setupExpand>) => ctx.expand.closeFromButton()],
  ])('honors the %s close policy', async (_label, close) => {
    const ctx = setupExpand()
    await openExpand(ctx.expand, browser)
    close(ctx)
    await nextTick()
    expect(ctx.expand.isVisible.value).toBe(false)
    finishClose(ctx.target)
    expect(ctx.expand.isExpandActive.value).toBe(false)
  })

  it('keeps every configured close exit disabled', async () => {
    const ctx = setupExpand({
      ...DEFAULT_EXPAND_OPTIONS,
      invokeCloseOn: { esc: false, wheel: false, swipe: false, overlayClick: false, closeButtonClick: false },
    })
    await openExpand(ctx.expand, browser)

    browser.documentTarget.dispatch('keydown', { key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() })
    browser.windowTarget.dispatch('wheel', { target: {}, ctrlKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
    browser.windowTarget.dispatch('touchstart', { touches: [{}], changedTouches: [{ screenY: 10 }] })
    browser.windowTarget.dispatch('touchmove', { touches: [{}], changedTouches: [{ screenY: 30 }] })
    ctx.modal.dispatch('click', { target: ctx.modal, stopPropagation: vi.fn() })
    ctx.expand.closeFromButton()
    await nextTick()

    expect(ctx.expand.isVisible.value).toBe(true)
  })

  it.each([
    { eventName: 'resize', changesLayoutViewport: true },
    { eventName: 'orientationchange', changesLayoutViewport: true },
    { eventName: 'visual viewport resize', changesLayoutViewport: false },
  ])('refits after $eventName when layout geometry changes and cancels delayed work on close', async ({ eventName, changesLayoutViewport }) => {
    const ctx = setupExpand()
    await openExpand(ctx.expand, browser)
    if (changesLayoutViewport) browser.resizeViewport(900, 700, 1200)
    const target = eventName === 'visual viewport resize' ? browser.visualViewport : browser.windowTarget
    target.dispatch(eventName === 'visual viewport resize' ? 'resize' : eventName)
    browser.flushRafs()
    expect(ctx.expand.expandTargetStyle.value.transitionDuration).toBe(changesLayoutViewport ? '0ms' : undefined)

    ctx.expand.toggle()
    finishClose(ctx.target)
    vi.runAllTimers()
    browser.flushRafs()

    expect(ctx.expand.isExpandActive.value).toBe(false)
    expect(document.body.style.overflow).toBe('auto')
  })

  it('derives resized layout width from the session gutter without unlocking', async () => {
    const ctx = setupExpand()
    await openExpand(ctx.expand, browser)

    expect(document.documentElement.style.width).toBe('980px')
    expect(document.body.style.width).toBe('980px')

    browser.resizeViewport(800, 600, 1200)
    browser.windowTarget.dispatch('resize')
    browser.flushRafs()
    expect(document.documentElement.style.width).toBe('780px')
    expect(document.body.style.width).toBe('780px')

    browser.resizeViewport(800, 1400, 1200)
    browser.windowTarget.dispatch('resize')
    browser.flushRafs()
    expect(document.documentElement.style.width).toBe('800px')
    expect(document.body.style.width).toBe('800px')

    ctx.expand.toggle()
    finishClose(ctx.target)
    expect(document.documentElement.style.width).toBe('120px')
    expect(document.body.style.width).toBe('80px')
  })

  it('keeps the scrollbar-excluded content viewport as the expand coordinate plane', async () => {
    browser.visualViewport.width = 980
    const ctx = setupExpand()

    await openExpand(ctx.expand, browser)

    expect(document.documentElement.style.width).toBe('980px')
    expect(document.body.style.width).toBe('980px')
    expect(ctx.expand.expandClipStyle.value.width).toBe('980px')
    expect(ctx.expand.expandTargetStyle.value.transform).toContain('scale(4.9)')
  })

  it('keeps one opening snapshot through scrollbar and viewport resize events', async () => {
    browser.visualViewport.width = 980
    browser.setTransitionDuration('0.3s')
    const ctx = setupExpand()

    ctx.expand.toggle()
    await nextTick()
    browser.flushRafs()
    await nextTick()
    browser.flushRafs()
    await nextTick()

    browser.visualViewport.width = 1000
    browser.visualViewport.dispatch('resize')
    browser.flushRafs()

    expect(ctx.expand.isVisible.value).toBe(true)
    expect(ctx.expand.expandTargetStyle.value.transitionDuration).toBeUndefined()
    expect(ctx.expand.expandClipStyle.value.width).toBe('980px')

    browser.resizeViewport(800, 600, 1200)
    browser.windowTarget.dispatch('resize')
    browser.flushRafs()

    expect(ctx.expand.expandTargetStyle.value.transitionDuration).toBeUndefined()
    expect(ctx.expand.expandClipStyle.value.width).toBe('980px')

    ctx.target.dispatch('transitionend', { propertyName: 'transform' })
    browser.flushRafs()

    expect(ctx.expand.expandTargetStyle.value.transitionDuration).toBe('0ms')
    expect(ctx.expand.expandClipStyle.value.width).toBe('780px')
  })

  it.each(['close', 'replacement', 'scope disposal'])('cancels active interaction, hints, listeners and pending work on %s', async (ending) => {
    const scope = effectScope()
    const ctx = scope.run(() => setupExpand())!
    await openExpand(ctx.expand, browser)
    await nextTick()

    browser.documentTarget.dispatch('keydown', { code: 'Space', repeat: false, preventDefault: vi.fn() })
    ctx.modal.dispatch('mousedown', { preventDefault: vi.fn(), clientX: 10, clientY: 10 })
    browser.windowTarget.dispatch('wheel', { target: ctx.target.children[0], ctrlKey: false, metaKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() })
    browser.windowTarget.dispatch('resize')
    expect(document.body.style.userSelect).toBe('none')
    expect(ctx.expand.showZoomHint.value).toBe(true)

    if (ending === 'close') {
      ctx.expand.toggle()
      finishClose(ctx.target)
    }
    else if (ending === 'replacement') {
      ctx.expand.endForDiagramReplacement()
    }
    else {
      scope.stop()
    }
    await nextTick()

    expect(ctx.expand.isExpandActive.value).toBe(false)
    expect(document.body.style.userSelect).toBe('text')
    expect(document.documentElement.style.userSelect).toBe('text')
    expect(document.body.style.overflow).toBe('auto')
    expect(ctx.expand.showZoomHint.value).toBe(false)
    expect(browser.windowTarget.listenerCount('wheel')).toBe(0)
    expect(browser.documentTarget.listenerCount('keydown')).toBe(0)

    vi.runAllTimers()
    browser.flushRafs()
    expect(document.body.style).toMatchObject({ overflow: 'auto', userSelect: 'text' })
  })

  it('cancels the opening frame when closed before activation', async () => {
    const ctx = setupExpand()
    ctx.expand.toggle()
    await nextTick()
    const staleOpeningFrame = browser.rafHistory[0]

    ctx.expand.toggle()
    finishClose(ctx.target)
    staleOpeningFrame?.(0)

    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(ctx.expand.isExpandActive.value).toBe(false)
    expect(document.body.style.overflow).toBe('auto')
  })
})
