import { computed, nextTick, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { FULLSCREEN_ZOOM_HINT_DURATION_MS } from '../constants'
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

export function useMermaidFullscreen(options: UseMermaidFullscreenOptions) {
  const browserDocument = options.document
    ?? (typeof document === 'undefined' ? undefined : document)
  const browserWindow = options.window
    ?? (typeof window === 'undefined' ? undefined : window)
  const fullscreenTarget = computed(() => options.getFullscreenTarget())
  const renderTarget = computed(() => options.getRenderTarget())
  const fullscreen = useFullscreen(fullscreenTarget, {
    document: browserDocument,
  })
  const isActive = fullscreen.isFullscreen
  const interactionActive = ref(false)
  const zoom = useMermaidZoom({
    active: interactionActive,
    minScale: 0.1,
    maxScale: 10,
    document: browserDocument,
    window: browserWindow,
  })
  const showZoomHint = ref(false)
  let hasShownZoomHint = false
  let hintTimeout: ReturnType<typeof setTimeout> | undefined
  let refreshRaf1: number | undefined
  let refreshRaf2: number | undefined
  // Invalidates nextTick and RAF work when an exit races queued initialization or refresh.
  let lifecycleId = 0

  const targetStyle = computed<CSSProperties>(() => ({
    ...zoom.transformStyle.value,
    transformOrigin: '0 0',
    cursor: zoom.cursor.value,
  }))
  let styledTarget: HTMLElement | null = null
  let originalTargetStyle = { transform: '', transformOrigin: '', cursor: '' }

  function restoreTargetStyle() {
    if (!styledTarget) return
    Object.assign(styledTarget.style, originalTargetStyle)
    styledTarget = null
  }

  function syncTargetStyle() {
    const target = interactionActive.value ? renderTarget.value : null
    if (styledTarget !== target) {
      restoreTargetStyle()
      if (target) {
        styledTarget = target
        originalTargetStyle = {
          transform: target.style.transform,
          transformOrigin: target.style.transformOrigin,
          cursor: target.style.cursor,
        }
      }
    }
    if (!styledTarget) return
    styledTarget.style.transform = targetStyle.value.transform as string
    styledTarget.style.transformOrigin = targetStyle.value.transformOrigin as string
    styledTarget.style.cursor = targetStyle.value.cursor as string
  }

  watch([interactionActive, targetStyle, renderTarget], syncTargetStyle, { flush: 'sync' })

  function clearScheduledViewportWork() {
    if (refreshRaf1 != null) browserWindow?.cancelAnimationFrame(refreshRaf1)
    if (refreshRaf2 != null) browserWindow?.cancelAnimationFrame(refreshRaf2)
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
    interactionActive.value = false
    restoreTargetStyle()
    lifecycleId++
    hideZoomHint()
    clearScheduledViewportWork()
    zoom.cancelInteraction()
    resetPresentation()
  }

  function initializeViewport(id: number) {
    if (!interactionActive.value || !isActive.value || id !== lifecycleId) return
    const target = renderTarget.value
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
    interactionActive.value = true
    hasShownZoomHint = false
    hideZoomHint()
    nextTick(() => initializeViewport(id))
  }

  watch(isActive, (active) => {
    if (active) startLifecycle()
    else stopLifecycle()
  }, { flush: 'sync' })

  function refreshViewportOrigin() {
    if (!interactionActive.value || !browserWindow) return
    const id = lifecycleId
    clearScheduledViewportWork()
    // Browser UI changes can move the fullscreen coordinate system across two frames.
    refreshRaf1 = browserWindow.requestAnimationFrame(() => {
      refreshRaf1 = undefined
      if (!interactionActive.value || id !== lifecycleId) return
      refreshRaf2 = browserWindow.requestAnimationFrame(() => {
        refreshRaf2 = undefined
        if (!interactionActive.value || id !== lifecycleId) return
        const target = renderTarget.value
        if (!target) return
        const rect = target.getBoundingClientRect()
        zoom.setOrigin(rect.left, rect.top)
      })
    })
  }

  function hideZoomHint() {
    clearTimeout(hintTimeout)
    hintTimeout = undefined
    showZoomHint.value = false
  }

  function handleWheel(event: WheelEvent) {
    if (!interactionActive.value) return
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
    }, FULLSCREEN_ZOOM_HINT_DURATION_MS)
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
    if (!interactionActive.value) return
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
      'ArrowUp': () => zoom.panBy(0, moveStep),
      'ArrowDown': () => zoom.panBy(0, -moveStep),
      'ArrowLeft': () => zoom.panBy(moveStep, 0),
      'ArrowRight': () => zoom.panBy(-moveStep, 0),
    }
    const handler = keyHandlers[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  if (browserDocument && browserWindow) {
    const activeWindow = computed(() => interactionActive.value ? browserWindow : null)
    const activeDocument = computed(() => interactionActive.value ? browserDocument : null)
    const activeVisualViewport = computed(() => interactionActive.value ? browserWindow.visualViewport : null)
    const activeViewport = computed(() => interactionActive.value ? options.getViewportTarget() : null)

    useEventListener(activeWindow, 'wheel', handleWheel, { passive: false })
    useEventListener(activeDocument, 'keydown', handleKeyDown)
    useEventListener(activeWindow, 'focus', refreshViewportOrigin)
    useEventListener(activeDocument, 'fullscreenchange', refreshViewportOrigin)
    useEventListener(activeVisualViewport, 'resize', refreshViewportOrigin, { passive: true })
    useEventListener(activeDocument, 'visibilitychange', () => {
      if (browserDocument.visibilityState === 'visible') refreshViewportOrigin()
    })
    useEventListener(activeViewport, 'mousedown', event => interactionActive.value && zoom.handleDragStart(event))
    useEventListener(activeViewport, 'mousemove', event => interactionActive.value && zoom.handleDragMove(event))
    useEventListener(activeViewport, 'touchstart', event => interactionActive.value && zoom.handleDragStart(event))
    useEventListener(activeViewport, 'touchmove', event => interactionActive.value && zoom.handleDragMove(event))
    useEventListener(activeViewport, 'touchend', () => interactionActive.value && zoom.handleDragEnd())
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
    scale: computed(() => zoom.scale.value),
    showZoomHint,
    toggle,
    endForDiagramReplacement,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    resetZoom: zoom.reset,
  }
}
