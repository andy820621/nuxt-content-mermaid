import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMermaidZoom } from '../src/runtime/composables/useMermaidZoom'

const stubBrowserGlobals = () => {
  const addEventListener = vi.fn()
  const removeEventListener = vi.fn()
  const stubDocument = {
    addEventListener,
    removeEventListener,
    documentElement: { style: { userSelect: '' } },
    body: { style: { userSelect: '' } },
  }
  const stubWindow = {
    innerWidth: 0,
    innerHeight: 0,
    addEventListener,
    removeEventListener,
    document: stubDocument,
  }

  vi.stubGlobal('window', stubWindow)
  vi.stubGlobal('document', stubDocument)
}

const setWindowSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

const createWheelEvent = (overrides: Partial<WheelEvent> = {}) => {
  return {
    deltaY: 100,
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as WheelEvent
}

const createMouseEvent = (x: number, y: number) => {
  return {
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
  } as unknown as MouseEvent
}

describe('useMermaidZoom', () => {
  beforeEach(() => {
    stubBrowserGlobals()
    setWindowSize(1000, 800)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('init sets metrics and resets interaction state', () => {
    const zoom = useMermaidZoom()
    zoom.isDragging.value = true
    zoom.isPointerDown.value = true
    zoom.isSpacePressed.value = true
    zoom.wasLastInteractionDrag.value = true

    zoom.init({
      scale: 2,
      translateX: 12,
      translateY: -8,
      top: 40,
      left: 20,
    })

    expect(zoom.scale.value).toBe(2)
    expect(zoom.translateX.value).toBe(12)
    expect(zoom.translateY.value).toBe(-8)
    expect(zoom.isDragging.value).toBe(false)
    expect(zoom.isPointerDown.value).toBe(false)
    expect(zoom.isSpacePressed.value).toBe(false)
    expect(zoom.wasLastInteractionDrag.value).toBe(false)
    expect(zoom.cursor.value).toBe('auto')
  })

  it('reset restores initial metrics', () => {
    const zoom = useMermaidZoom()
    zoom.init({ scale: 1.5, translateX: 10, translateY: 20 })
    zoom.setMetrics({ scale: 3, translateX: 100, translateY: -50 })

    zoom.reset()

    expect(zoom.scale.value).toBe(1.5)
    expect(zoom.translateX.value).toBe(10)
    expect(zoom.translateY.value).toBe(20)
  })

  it('zoomIn and zoomOut respect min/max scale', () => {
    const zoom = useMermaidZoom({ minScale: 0.9, maxScale: 1.1 })
    zoom.init({ scale: 1, translateX: 0, translateY: 0, top: 0, left: 0 })

    zoom.zoomIn()
    expect(zoom.scale.value).toBe(1.1)

    zoom.zoomOut()
    expect(zoom.scale.value).toBe(0.9)

    zoom.zoomOut()
    expect(zoom.scale.value).toBe(0.9)
  })

  it('handleWheel requires modifier and updates scale', () => {
    const zoom = useMermaidZoom({ zoomSpeed: 0.2 })
    zoom.init({ scale: 1, translateX: 0, translateY: 0, top: 0, left: 0 })

    const noModifier = createWheelEvent()
    expect(zoom.handleWheel(noModifier)).toBe(false)
    expect(zoom.scale.value).toBe(1)
    expect(noModifier.preventDefault).not.toHaveBeenCalled()
    expect(noModifier.stopPropagation).not.toHaveBeenCalled()

    const withCtrl = createWheelEvent({ ctrlKey: true, deltaY: 120, clientX: 10, clientY: 20 })
    expect(zoom.handleWheel(withCtrl)).toBe(true)
    expect(zoom.scale.value).toBeLessThan(1)
    expect(withCtrl.preventDefault).toHaveBeenCalledTimes(1)
    expect(withCtrl.stopPropagation).toHaveBeenCalledTimes(1)
  })

  it('mouse drag requires space and updates translate', () => {
    const zoom = useMermaidZoom()
    zoom.init({ scale: 1, translateX: 0, translateY: 0 })

    zoom.handleDragStart(createMouseEvent(0, 0))
    expect(zoom.isPointerDown.value).toBe(false)

    zoom.isSpacePressed.value = true
    const start = createMouseEvent(0, 0)
    zoom.handleDragStart(start)
    expect(start.preventDefault).toHaveBeenCalledTimes(1)
    expect(zoom.isPointerDown.value).toBe(true)
    expect(zoom.cursor.value).toBe('grab')

    const move = createMouseEvent(10, 0)
    zoom.handleDragMove(move)
    expect(move.preventDefault).toHaveBeenCalledTimes(1)
    expect(zoom.isDragging.value).toBe(true)
    expect(zoom.translateX.value).toBe(10)
    expect(zoom.cursor.value).toBe('grabbing')

    zoom.handleDragEnd()
    expect(zoom.isPointerDown.value).toBe(false)
    expect(zoom.isDragging.value).toBe(false)
    expect(zoom.wasLastInteractionDrag.value).toBe(true)
  })

  it('small movement does not count as drag', () => {
    const zoom = useMermaidZoom()
    zoom.init({ scale: 1, translateX: 0, translateY: 0 })
    zoom.isSpacePressed.value = true

    zoom.handleDragStart(createMouseEvent(0, 0))
    zoom.handleDragMove(createMouseEvent(3, 0))
    zoom.handleDragEnd()

    expect(zoom.isDragging.value).toBe(false)
    expect(zoom.translateX.value).toBe(0)
    expect(zoom.wasLastInteractionDrag.value).toBe(false)
  })
})
