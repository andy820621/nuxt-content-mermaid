import { computed, nextTick, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type { ConfigurableDocument, ConfigurableWindow } from './_configurable'
import { tryOnScopeDispose } from './shared'
import { useEventListener } from './useEventListener'
import { useFullscreen } from './useFullscreen'
import { useMermaidZoom } from './useMermaidZoom'

interface UseMermaidFullscreenOptions extends ConfigurableDocument, ConfigurableWindow {
  getFullscreenTarget: () => HTMLElement | null
  getViewportTarget: () => HTMLElement | null
  getRenderTarget: () => HTMLElement | null
}

const hintDurationMs = 3000

export function useMermaidFullscreen(options: UseMermaidFullscreenOptions) {
  const browserDocument = options.document
    ?? (typeof document === 'undefined' ? undefined : document)
  const browserWindow = options.window
    ?? (typeof window === 'undefined' ? undefined : window)
  const fullscreenTarget = computed(() => options.getFullscreenTarget())
  const fullscreen = useFullscreen(fullscreenTarget, {
    document: browserDocument,
  })
  const isActive = fullscreen.isFullscreen
  const zoom = useMermaidZoom({
    active: isActive,
    minScale: 0.1,
    maxScale: 10,
  })
  const showZoomHint = ref(false)
  let hasShownZoomHint = false
  let hintTimeout: ReturnType<typeof setTimeout> | undefined
  let refreshRaf1: number | undefined
  let refreshRaf2: number | undefined
  let lifecycleId = 0

  const targetStyle = computed<CSSProperties>(() => ({
    ...zoom.transformStyle.value,
    transformOrigin: '0 0',
    cursor: zoom.cursor.value,
  }))

  function clearScheduledViewportWork() {
    if (refreshRaf1 != null) cancelAnimationFrame(refreshRaf1)
    if (refreshRaf2 != null) cancelAnimationFrame(refreshRaf2)
    refreshRaf1 = undefined
    refreshRaf2 = undefined
  }

  function resetPresentation() {
    zoom.init({
      scale: 1,
      translateX: 0,
      translateY: 0,
      top: 0,
      left: 0,
    })
  }

  function stopLifecycle() {
    lifecycleId++
    clearTimeout(hintTimeout)
    hintTimeout = undefined
    clearScheduledViewportWork()
    showZoomHint.value = false
    zoom.cancelInteraction()
    resetPresentation()
  }

  function initializeViewport(id: number) {
    if (!isActive.value || id !== lifecycleId) return
    const target = options.getRenderTarget()
    if (!target) return
    const rect = target.getBoundingClientRect()
    zoom.init({
      scale: 1,
      translateX: 0,
      translateY: 0,
      top: rect.top,
      left: rect.left,
    })
  }

  function startLifecycle() {
    const id = ++lifecycleId
    hasShownZoomHint = false
    clearTimeout(hintTimeout)
    hintTimeout = undefined
    showZoomHint.value = false
    nextTick(() => initializeViewport(id))
  }

  watch(isActive, (active) => {
    if (active) startLifecycle()
    else stopLifecycle()
  }, { flush: 'sync' })

  function refreshViewportOrigin() {
    if (!isActive.value) return
    const id = lifecycleId
    clearScheduledViewportWork()
    refreshRaf1 = requestAnimationFrame(() => {
      refreshRaf1 = undefined
      if (!isActive.value || id !== lifecycleId) return
      refreshRaf2 = requestAnimationFrame(() => {
        refreshRaf2 = undefined
        if (!isActive.value || id !== lifecycleId) return
        const target = options.getRenderTarget()
        if (!target) return
        const rect = target.getBoundingClientRect()
        zoom.setMetrics({
          scale: zoom.scale.value,
          translateX: zoom.translateX.value,
          translateY: zoom.translateY.value,
          top: rect.top,
          left: rect.left,
        })
      })
    })
  }

  function hideZoomHint() {
    clearTimeout(hintTimeout)
    hintTimeout = undefined
    showZoomHint.value = false
  }

  function handleWheel(event: WheelEvent) {
    if (zoom.handleWheel(event)) {
      if (showZoomHint.value) hideZoomHint()
      return
    }

    if (hasShownZoomHint) return
    hasShownZoomHint = true
    showZoomHint.value = true
    clearTimeout(hintTimeout)
    hintTimeout = setTimeout(() => {
      showZoomHint.value = false
      hintTimeout = undefined
    }, hintDurationMs)
  }

  function isEditableTarget(target: EventTarget | null) {
    if (!target || typeof target !== 'object') return false
    const element = target as HTMLElement
    const tagName = element.tagName
    return element.isContentEditable
      || tagName === 'INPUT'
      || tagName === 'TEXTAREA'
      || tagName === 'SELECT'
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || isEditableTarget(event.target)) return

    const browserZoomKeys = new Set(['+', '=', '-', '_'])
    if (event.ctrlKey || event.metaKey) {
      if (browserZoomKeys.has(event.key)) event.preventDefault()
      return
    }

    const moveStep = 20 / zoom.scale.value
    const keyHandlers: Record<string, () => void> = {
      '+': zoom.zoomIn,
      '=': zoom.zoomIn,
      '-': zoom.zoomOut,
      '_': zoom.zoomOut,
      '0': zoom.reset,
      'ArrowUp': () => { zoom.translateY.value += moveStep },
      'ArrowDown': () => { zoom.translateY.value -= moveStep },
      'ArrowLeft': () => { zoom.translateX.value += moveStep },
      'ArrowRight': () => { zoom.translateX.value -= moveStep },
    }
    const handler = keyHandlers[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  if (browserDocument && browserWindow) {
    const activeWindow = computed(() => isActive.value ? browserWindow : null)
    const activeDocument = computed(() => isActive.value ? browserDocument : null)
    const activeVisualViewport = computed(() => isActive.value ? browserWindow.visualViewport : null)
    const activeViewport = computed(() => isActive.value ? options.getViewportTarget() : null)

    useEventListener(activeWindow, 'wheel', handleWheel, { passive: false })
    useEventListener(activeDocument, 'keydown', handleKeyDown)
    useEventListener(activeWindow, 'focus', refreshViewportOrigin)
    useEventListener(activeDocument, 'fullscreenchange', refreshViewportOrigin)
    useEventListener(activeVisualViewport, 'resize', refreshViewportOrigin, { passive: true })
    useEventListener(activeDocument, 'visibilitychange', () => {
      if (browserDocument.visibilityState === 'visible') refreshViewportOrigin()
    })
    useEventListener(activeViewport, 'mousedown', zoom.handleDragStart)
    useEventListener(activeViewport, 'mousemove', zoom.handleDragMove)
    useEventListener(activeViewport, 'touchstart', zoom.handleDragStart)
    useEventListener(activeViewport, 'touchmove', zoom.handleDragMove)
    useEventListener(activeViewport, 'touchend', zoom.handleDragEnd)
  }

  async function toggle() {
    await fullscreen.toggle()
  }

  async function endForDiagramReplacement() {
    stopLifecycle()
    await fullscreen.exit()
  }

  tryOnScopeDispose(() => {
    stopLifecycle()
    void fullscreen.exit()
  })

  return {
    isSupported: fullscreen.isSupported,
    isActive,
    targetStyle,
    scale: computed(() => zoom.scale.value),
    showZoomHint,
    toggle,
    endForDiagramReplacement,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    resetZoom: zoom.reset,
  }
}
