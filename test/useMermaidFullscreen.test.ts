import { createRenderer, defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMermaidFullscreen } from '../src/runtime/composables/useMermaidFullscreen'

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

function createBrowser() {
  let rafId = 0
  const rafs = new Map<number, FrameRequestCallback>()
  const rafHistory: FrameRequestCallback[] = []
  const visualViewport = createEventTarget({ width: 1000, height: 800, scale: 1 })
  const documentElement = { style: { userSelect: 'text' } }
  const body = { style: { userSelect: 'text' } }
  const documentTarget = createEventTarget({
    body,
    documentElement,
    fullScreen: false,
    fullscreenElement: null as unknown,
    visibilityState: 'visible',
    exitFullscreen: vi.fn(async () => {
      documentTarget.fullScreen = false
      documentTarget.fullscreenElement = null
      documentTarget.dispatch('fullscreenchange')
    }),
  })
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = ++rafId
    rafs.set(id, callback)
    rafHistory.push(callback)
    return id
  })
  const cancelFrame = vi.fn((id: number) => rafs.delete(id))
  const windowTarget = createEventTarget({
    innerWidth: 1000,
    innerHeight: 800,
    visualViewport,
    document: documentTarget,
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame,
  })
  const fullscreenTarget = createEventTarget({
    nodeType: 1,
    requestFullscreen: vi.fn(async () => {
      documentTarget.fullScreen = true
      documentTarget.fullscreenElement = fullscreenTarget
      documentTarget.dispatch('fullscreenchange')
    }),
  })
  const viewportTarget = createEventTarget({ nodeType: 1 })
  let renderRect = { top: 20, left: 30, width: 200, height: 100 }
  const renderTarget = {
    nodeType: 1,
    style: { transform: '', transformOrigin: '', cursor: '' },
    getBoundingClientRect: () => renderRect,
  }

  vi.stubGlobal('document', documentTarget)
  vi.stubGlobal('window', windowTarget)
  vi.stubGlobal('requestAnimationFrame', requestFrame)
  vi.stubGlobal('cancelAnimationFrame', cancelFrame)

  return {
    documentTarget,
    windowTarget,
    visualViewport,
    fullscreenTarget,
    viewportTarget,
    renderTarget,
    rafHistory,
    setRenderRect(rect: typeof renderRect) {
      renderRect = rect
    },
    flushRafs() {
      const pending = [...rafs.entries()]
      rafs.clear()
      pending.forEach(([, callback]) => callback(0))
    },
  }
}

const renderer = createRenderer<Record<string, unknown>, Record<string, unknown>>({
  patchProp: () => {},
  insert: () => {},
  remove: () => {},
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText: () => {},
  setElementText: () => {},
  parentNode: () => null,
  nextSibling: () => null,
  querySelector: () => null,
  setScopeId: () => {},
  cloneNode: node => node,
  insertStaticContent: () => [{}, {}],
})

function mountFullscreen(browser: ReturnType<typeof createBrowser>) {
  let fullscreen: ReturnType<typeof useMermaidFullscreen> | undefined
  const app = renderer.createApp(defineComponent({
    setup() {
      fullscreen = useMermaidFullscreen({
        getFullscreenTarget: () => browser.fullscreenTarget as unknown as HTMLElement,
        getViewportTarget: () => browser.viewportTarget as unknown as HTMLElement,
        getRenderTarget: () => browser.renderTarget as unknown as HTMLElement,
        document: browser.documentTarget as unknown as Document,
        window: browser.windowTarget as unknown as Window,
      })
      return () => h('div')
    },
  }))
  app.mount({})

  return {
    fullscreen: fullscreen!,
    unmount: () => app.unmount(),
  }
}

async function enterFullscreen(fullscreen: ReturnType<typeof useMermaidFullscreen>) {
  await fullscreen.toggle()
  await nextTick()
}

describe('useMermaidFullscreen', () => {
  let browser: ReturnType<typeof createBrowser>

  beforeEach(() => {
    vi.useFakeTimers()
    browser = createBrowser()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('owns entry, viewport controls, interaction routing and exit cleanup', async () => {
    const { fullscreen } = mountFullscreen(browser)

    await enterFullscreen(fullscreen)

    expect(fullscreen.isActive.value).toBe(true)
    expect(browser.renderTarget.style.transform).toBe('translate(0px, 0px) scale(1)')
    expect(browser.windowTarget.listenerCount('wheel')).toBe(1)
    expect(browser.documentTarget.listenerCount('keydown')).toBeGreaterThan(0)

    fullscreen.zoomIn()
    expect(fullscreen.scale.value).toBe(1.25)

    browser.windowTarget.dispatch('wheel', {
      deltaY: 120,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })
    expect(fullscreen.showZoomHint.value).toBe(true)

    const zoomWheel = {
      deltaY: -120,
      clientX: 100,
      clientY: 100,
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    browser.windowTarget.dispatch('wheel', zoomWheel)
    expect(zoomWheel.preventDefault).toHaveBeenCalled()
    expect(fullscreen.showZoomHint.value).toBe(false)

    const arrow = { key: 'ArrowRight', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
    browser.documentTarget.dispatch('keydown', arrow)
    expect(arrow.preventDefault).toHaveBeenCalled()
    expect(browser.renderTarget.style.transform).not.toContain('translate(0px, 0px)')

    browser.documentTarget.dispatch('keydown', { code: 'Space', repeat: false, preventDefault: vi.fn() })
    browser.viewportTarget.dispatch('mousedown', { clientX: 10, clientY: 10, preventDefault: vi.fn() })
    expect(document.body.style.userSelect).toBe('none')

    await fullscreen.toggle()
    await nextTick()

    expect(fullscreen.isActive.value).toBe(false)
    expect(fullscreen.showZoomHint.value).toBe(false)
    expect(document.body.style.userSelect).toBe('text')
    expect(document.documentElement.style.userSelect).toBe('text')
    expect(browser.windowTarget.listenerCount('wheel')).toBe(0)
  })

  it.each(['exit', 'replacement', 'unmount'])('cancels hint, gesture, scheduled viewport work and routing on %s', async (ending) => {
    const mounted = mountFullscreen(browser)
    await enterFullscreen(mounted.fullscreen)

    browser.windowTarget.dispatch('wheel', {
      deltaY: 120,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })
    browser.documentTarget.dispatch('keydown', { code: 'Space', repeat: false, preventDefault: vi.fn() })
    browser.viewportTarget.dispatch('mousedown', { clientX: 10, clientY: 10, preventDefault: vi.fn() })
    browser.windowTarget.dispatch('focus')
    const staleFrame = browser.rafHistory.at(-1)

    if (ending === 'exit') {
      await mounted.fullscreen.toggle()
    }
    else if (ending === 'replacement') {
      const replacementEnd = mounted.fullscreen.endForDiagramReplacement()
      const wheel = {
        deltaY: 120,
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }
      const key = { key: 'ArrowDown', ctrlKey: false, metaKey: false, preventDefault: vi.fn() }
      const space = { code: 'Space', repeat: false, preventDefault: vi.fn() }
      browser.windowTarget.dispatch('wheel', wheel)
      browser.documentTarget.dispatch('keydown', key)
      browser.documentTarget.dispatch('keydown', space)
      expect(mounted.fullscreen.showZoomHint.value).toBe(false)
      expect(key.preventDefault).not.toHaveBeenCalled()
      expect(space.preventDefault).not.toHaveBeenCalled()
      expect(document.body.style.userSelect).toBe('text')
      await replacementEnd
    }
    else {
      mounted.unmount()
    }
    await nextTick()

    expect(mounted.fullscreen.isActive.value).toBe(false)
    expect(mounted.fullscreen.showZoomHint.value).toBe(false)
    expect(document.body.style.userSelect).toBe('text')
    expect(browser.windowTarget.listenerCount('wheel')).toBe(0)
    expect(browser.documentTarget.listenerCount('keydown')).toBe(0)
    expect(cancelAnimationFrame).toHaveBeenCalled()

    vi.runAllTimers()
    browser.flushRafs()
    staleFrame?.(0)
    expect(mounted.fullscreen.isActive.value).toBe(false)
    expect(browser.renderTarget.style).toMatchObject({ transform: '', transformOrigin: '', cursor: '' })
  })

  it('keeps inactive diagrams isolated from fullscreen routing', async () => {
    const first = mountFullscreen(browser)
    const secondBrowser = createBrowser()
    const second = mountFullscreen(secondBrowser)

    await enterFullscreen(first.fullscreen)
    first.fullscreen.zoomIn()

    expect(first.fullscreen.scale.value).toBe(1.25)
    expect(second.fullscreen.isActive.value).toBe(false)
    expect(second.fullscreen.scale.value).toBe(1)
    expect(secondBrowser.windowTarget.listenerCount('wheel')).toBe(0)

    first.unmount()
    second.unmount()
  })
})
