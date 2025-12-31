import { computed, nextTick, ref } from 'vue'
import type { CSSProperties, ComponentPublicInstance, Ref } from 'vue'
import type { ExpandInvokeCloseOn, ExpandInvokeOpenOn } from '../types/expand'
import { useMermaidZoom } from './useMermaidZoom'
import { useEventListener } from './useEventListener'
import { tryOnScopeDispose } from './shared/tryOnScopeDispose'

type ExpandState = 'idle' | 'opening' | 'open' | 'closing'

interface ExpandMetrics {
  top: number
  left: number
  width: number
  height: number
  translateX: number
  translateY: number
  scale: number
}

interface UseMermaidExpandOptions {
  getExpandTarget: () => SVGElement | null
  expandMargin?: number
  isBlocked?: Ref<boolean>
  invokeOpenOn?: ExpandInvokeOpenOn
  invokeCloseOn?: ExpandInvokeCloseOn
}

const swipeToCloseThreshold = 10

export function useMermaidExpand(options: UseMermaidExpandOptions) {
  const isClient = typeof import.meta.client === 'boolean'
    ? import.meta.client
    : typeof window !== 'undefined' && typeof document !== 'undefined'
  const expandTargetWrap = ref<HTMLDivElement | null>(null)
  const setExpandTargetWrap = (el: Element | ComponentPublicInstance | null) => {
    if (el && 'nodeType' in el) {
      expandTargetWrap.value = el as HTMLDivElement
      return
    }
    expandTargetWrap.value = null
  }
  const expandState = ref<ExpandState>('idle')
  const expandMetrics = ref<ExpandMetrics | null>(null)
  const isExpanded = ref(false)
  const showZoomHint = ref(false)
  let hasShownZoomHint = false
  let hintTimeout: ReturnType<typeof setTimeout> | undefined

  const shouldRefreshExpand = ref(false)

  // Use zoom transform when expanded
  const isExpandActive = computed(() => expandState.value !== 'idle')

  const zoom = useMermaidZoom({
    active: isExpandActive,
    minScale: 0.1,
    maxScale: 10,
  })
  const isVisible = computed(() => expandState.value === 'open')
  const allowTargetClick = options.invokeOpenOn?.diagramClick !== false
  const allowCloseByEsc = options.invokeCloseOn?.esc !== false
  const allowCloseByWheel = options.invokeCloseOn?.wheel !== false
  const allowCloseBySwipe = options.invokeCloseOn?.swipe !== false

  const expandTargetStyle = computed<CSSProperties>(() => {
    const metrics = expandMetrics.value
    if (!metrics) return {}

    const { transform } = zoom.transformStyle.value

    return {
      top: `${metrics.top}px`,
      left: `${metrics.left}px`,
      width: `${metrics.width}px`,
      height: `${metrics.height}px`,
      transform: isExpanded.value
        ? transform
        : 'translate(0px, 0px) scale(1)',
      transitionDuration: (shouldRefreshExpand.value || zoom.isPointerDown.value) ? '0ms' : undefined,
    }
  })

  let expandTransitionTimeout: ReturnType<typeof setTimeout> | undefined
  let expandResizeTimeout: ReturnType<typeof setTimeout> | undefined

  const resizeDoubleRaf = {
    raf1: undefined as number | undefined,
    raf2: undefined as number | undefined,
    run(fn: () => void) {
      this.cancel()
      this.raf1 = requestAnimationFrame(() => {
        fn()
        this.raf2 = requestAnimationFrame(() => {
          fn()
          this.raf2 = undefined
        })
        this.raf1 = undefined
      })
    },
    cancel() {
      if (this.raf1 != null) cancelAnimationFrame(this.raf1)
      if (this.raf2 != null) cancelAnimationFrame(this.raf2)
      this.raf1 = undefined
      this.raf2 = undefined
    },
  }

  let expandRefreshRaf: number | undefined
  // Wait for UI transition to settle (e.g., keyboard, address bar, rotation)
  const resizeRefreshDelay = 180
  const scrollState = {
    bodyOverflow: '',
    bodyWidth: '',
    htmlOverflow: '',
    htmlWidth: '',
    lockedWidth: false,
  }
  const touchState: { isScaling: boolean, start?: number, end?: number } = {
    isScaling: false,
  }
  let expandInstanceId = 0

  function resolveExpandMargin() {
    const margin = options.expandMargin
    if (typeof margin !== 'number' || Number.isNaN(margin)) return 0
    return Math.max(0, margin)
  }

  function getLayoutViewportSize() {
    const viewport = window.visualViewport
    const scale = viewport?.scale ?? 1
    return {
      width: (viewport?.width ?? window.innerWidth) * scale,
      height: (viewport?.height ?? window.innerHeight) * scale,
    }
  }

  function getLockedViewportWidth() {
    const width = document.documentElement.clientWidth || window.innerWidth
    return Math.max(1, Math.round(width))
  }

  function shouldLockWidth() {
    return window.innerWidth - document.documentElement.clientWidth > 0
  }

  function updateLockedWidth() {
    if (!scrollState.lockedWidth || document.body.style.overflow !== 'hidden') return
    document.documentElement.style.width = ''
    document.body.style.width = ''
    // Force reflow so the layout viewport picks up the latest size.
    void document.body.offsetHeight
    const clientWidth = getLockedViewportWidth()
    document.documentElement.style.width = `${clientWidth}px`
    document.body.style.width = `${clientWidth}px`
  }

  function clearResizeTimers() {
    clearTimeout(expandResizeTimeout)
    resizeDoubleRaf.cancel()
    expandResizeTimeout = undefined
  }

  function clearRefreshRaf() {
    if (expandRefreshRaf != null) cancelAnimationFrame(expandRefreshRaf)
    expandRefreshRaf = undefined
  }

  function calculateExpandMetrics(target: SVGElement): ExpandMetrics | null {
    const rect = target.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    const margin = resolveExpandMargin()
    const { width, height } = getLayoutViewportSize()
    const viewportWidth = Math.max(1, width - margin * 2)
    const viewportHeight = Math.max(1, height - margin * 2)
    const scaleX = viewportWidth / rect.width
    const scaleY = viewportHeight / rect.height
    const scale = Number.isFinite(scaleX) && Number.isFinite(scaleY)
      ? Math.min(scaleX, scaleY)
      : 1
    const safeScale = scale > 0 ? scale : 1

    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      translateX: width / 2 - (rect.left + rect.width * safeScale / 2),
      translateY: height / 2 - (rect.top + rect.height * safeScale / 2),
      scale: safeScale,
    }
  }

  function adjustSvgIDs(svgEl: SVGElement, suffix: string): void {
    const attrs = [
      'clip-path',
      'fill',
      'mask',
      'marker-start',
      'marker-mid',
      'marker-end',
    ]

    const idMap = new Map<string, string>()

    if (svgEl.hasAttribute('id')) {
      const oldId = svgEl.id
      const newId = oldId + suffix
      idMap.set(oldId, newId)
      svgEl.id = newId
    }

    svgEl.querySelectorAll('[id]').forEach((el) => {
      const oldId = el.id
      const newId = oldId + suffix
      idMap.set(oldId, newId)
      el.id = newId
    })

    idMap.forEach((newId, oldId) => {
      const urlOldID = `url(#${oldId})`
      const urlNewID = `url(#${newId})`
      const attrsQuery = attrs.map(attr => `[${attr}="${urlOldID}"]`).join(', ')

      svgEl.querySelectorAll(attrsQuery).forEach((usedEl) => {
        attrs.forEach((attr) => {
          if (usedEl.getAttribute(attr) === urlOldID) {
            usedEl.setAttribute(attr, urlNewID)
          }
        })
      })
    })

    svgEl.querySelectorAll('style').forEach((styleEl) => {
      if (!styleEl.textContent) return

      idMap.forEach((newId, oldId) => {
        styleEl.textContent = styleEl.textContent.replaceAll(`#${oldId}`, `#${newId}`)
      })
    })
  }

  function mountExpandSvg(svg: SVGElement) {
    const wrap = expandTargetWrap.value
    if (!wrap) return false

    wrap.textContent = ''
    const clone = svg.cloneNode(true) as SVGElement
    const suffix = `-ncm-${expandInstanceId++}`
    adjustSvgIDs(clone, suffix)
    clone.removeAttribute('width')
    clone.removeAttribute('height')
    clone.style.width = '100%'
    clone.style.height = '100%'
    wrap.appendChild(clone)
    return true
  }

  function clearExpandSvg() {
    if (!expandTargetWrap.value) return
    expandTargetWrap.value.textContent = ''
  }

  function resetExpand() {
    if (!isClient) return
    clearTimeout(expandTransitionTimeout)
    clearTimeout(hintTimeout)
    clearResizeTimers()
    clearRefreshRaf()
    clearExpandSvg()
    expandState.value = 'idle'
    isExpanded.value = false
    shouldRefreshExpand.value = false
    showZoomHint.value = false
    expandMetrics.value = null
    enableBodyScroll()
  }

  function openExpand(_event?: Event) {
    if (!isClient || isExpandActive.value) return
    if (options.isBlocked?.value) return

    const svg = options.getExpandTarget()
    if (!svg) return

    const metrics = calculateExpandMetrics(svg)
    if (!metrics) return

    expandMetrics.value = metrics
    hasShownZoomHint = false // Reset hint flag for new expand

    // Init zoom state
    zoom.init({
      scale: metrics.scale,
      translateX: metrics.translateX,
      translateY: metrics.translateY,
      top: metrics.top,
      left: metrics.left,
    })

    expandState.value = 'opening'
    isExpanded.value = false
    disableBodyScroll()

    nextTick(() => {
      if (expandState.value !== 'opening') return
      if (!mountExpandSvg(svg)) {
        resetExpand()
        return
      }

      requestAnimationFrame(() => {
        if (expandState.value !== 'opening') return
        isExpanded.value = true
        expandState.value = 'open'
      })
    })
  }

  function closeExpand(_event?: Event) {
    if (!isClient || !isExpandActive.value) return
    if (expandState.value === 'opening' && !expandTargetWrap.value) {
      resetExpand()
      return
    }
    expandState.value = 'closing'
    isExpanded.value = false
    ensureExpandTransitionEnd()
  }

  function toggleExpand(event?: Event) {
    if (isExpandActive.value) {
      closeExpand(event)
    }
    else {
      openExpand(event)
    }
  }

  function handleExpandTransitionEnd(event: TransitionEvent) {
    if (event.propertyName !== 'transform') return
    if (expandState.value === 'closing') {
      resetExpand()
    }
  }

  function ensureExpandTransitionEnd() {
    if (!expandTargetWrap.value) return
    const duration = window.getComputedStyle(expandTargetWrap.value).transitionDuration
    const durationMs = Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000)
    if (!durationMs) return

    clearTimeout(expandTransitionTimeout)
    expandTransitionTimeout = setTimeout(() => {
      if (expandState.value === 'closing') resetExpand()
    }, durationMs + 50)
  }

  function handleExpandKeyDown(event: KeyboardEvent) {
    if (!allowCloseByEsc && event.key === 'Escape') return

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeExpand(event)
      return
    }

    const browserZoomKeys = new Set(['+', '=', '-', '_'])
    if (event.ctrlKey || event.metaKey) {
      if (browserZoomKeys.has(event.key))
        event.preventDefault()
      return
    }

    // Zoom/Pan keyboard shortcuts
    if (expandState.value !== 'open') return
    const moveStep = 20 / zoom.scale.value

    switch (event.key) {
      case '+':
      case '=':
        zoom.zoomIn()
        break
      case '-':
      case '_':
        zoom.zoomOut()
        break
      case '0':
        zoom.reset()
        break
      case 'ArrowUp':
        zoom.translateY.value += moveStep
        break
      case 'ArrowDown':
        zoom.translateY.value -= moveStep
        break
      case 'ArrowLeft':
        zoom.translateX.value += moveStep
        break
      case 'ArrowRight':
        zoom.translateX.value -= moveStep
        break
    }
  }

  function handleExpandWheel(event: WheelEvent) {
    const isInside = expandTargetWrap.value && expandTargetWrap.value.contains(event.target as Node)

    // Diagram interaction
    if (isInside) {
      // Try to zoom/pan first
      const handled = zoom.handleWheel(event)
      if (handled) return

      // Not handled - show hint once per expand
      event.preventDefault()
      event.stopPropagation()
      if (!hasShownZoomHint) {
        hasShownZoomHint = true
        showZoomHint.value = true
        hintTimeout = setTimeout(() => {
          showZoomHint.value = false
        }, 1500)
      }
      return
    }

    // Overlay interaction
    if (!allowCloseByWheel) return
    if (event.ctrlKey || event.metaKey) return
    event.preventDefault()
    event.stopPropagation()
    queueMicrotask(() => closeExpand(event))
  }

  function handleExpandTouchStart(event: TouchEvent) {
    // If double touch on diagram?
    if (zoom.isDragging.value) return

    if (!allowCloseBySwipe) return
    if (event.touches.length > 1) {
      touchState.isScaling = true
      return
    }

    if (event.changedTouches.length === 1 && event.changedTouches[0]) {
      touchState.start = event.changedTouches[0].screenY
    }
  }

  function handleExpandTouchMove(event: TouchEvent) {
    if (zoom.isDragging.value || touchState.isScaling) return

    if (!allowCloseBySwipe) return
    const browserScale = window.visualViewport?.scale ?? 1

    if (
      !touchState.isScaling
      && browserScale <= 1
      && touchState.start != null
      && event.changedTouches[0]
    ) {
      touchState.end = event.changedTouches[0].screenY

      const max = Math.max(touchState.start, touchState.end)
      const min = Math.min(touchState.start, touchState.end)
      const delta = Math.abs(max - min)

      if (delta > swipeToCloseThreshold) {
        touchState.start = undefined
        touchState.end = undefined
        closeExpand(event)
      }
    }
  }

  function handleExpandTouchEnd() {
    if (!allowCloseBySwipe) return
    touchState.isScaling = false
    touchState.start = undefined
    touchState.end = undefined
  }

  function handleExpandTouchCancel() {
    if (!allowCloseBySwipe) return
    touchState.isScaling = false
    touchState.start = undefined
    touchState.end = undefined
  }

  function handleExpandResize() {
    if (!isExpandActive.value) return
    scheduleExpandRefresh()
  }

  function refreshExpandMetrics() {
    if (!isExpandActive.value) return
    updateLockedWidth()

    const svg = options.getExpandTarget()
    if (!svg) return
    const metrics = calculateExpandMetrics(svg)
    if (!metrics) return
    expandMetrics.value = metrics

    // Re-init zoom on resize (Fit)
    zoom.init({
      scale: metrics.scale,
      translateX: metrics.translateX,
      translateY: metrics.translateY,
      top: metrics.top,
      left: metrics.left,
    })

    shouldRefreshExpand.value = true
    clearRefreshRaf()
    expandRefreshRaf = requestAnimationFrame(() => {
      shouldRefreshExpand.value = false
      expandRefreshRaf = undefined
    })
  }

  function scheduleExpandRefresh() {
    clearResizeTimers()

    resizeDoubleRaf.run(refreshExpandMetrics)

    // Some iOS rotation updates land after the first frame.
    expandResizeTimeout = setTimeout(() => {
      refreshExpandMetrics()
    }, resizeRefreshDelay)
  }

  if (isClient) {
    const activeWindow = computed(() => isExpandActive.value ? window : null)
    const activeDocument = computed(() => isExpandActive.value ? document : null)
    const activeVisualViewport = computed(() => (isExpandActive.value ? window.visualViewport : null))

    useEventListener(activeWindow, 'resize', handleExpandResize, { passive: true })
    useEventListener(activeWindow, 'orientationchange', handleExpandResize, { passive: true })
    useEventListener(activeVisualViewport, 'resize', handleExpandResize, { passive: true })
    useEventListener(activeWindow, 'wheel', handleExpandWheel, { passive: false })
    useEventListener(activeWindow, 'touchstart', handleExpandTouchStart, { passive: true })
    useEventListener(activeWindow, 'touchmove', handleExpandTouchMove, { passive: true })
    useEventListener(activeWindow, 'touchend', handleExpandTouchEnd, { passive: true })
    useEventListener(activeWindow, 'touchcancel', handleExpandTouchCancel, { passive: true })
    useEventListener(activeDocument, 'keydown', handleExpandKeyDown, true)
  }

  function disableBodyScroll() {
    scrollState.bodyOverflow = document.body.style.overflow
    scrollState.bodyWidth = document.body.style.width
    scrollState.htmlOverflow = document.documentElement.style.overflow
    scrollState.htmlWidth = document.documentElement.style.width
    scrollState.lockedWidth = shouldLockWidth()
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    if (scrollState.lockedWidth) {
      const clientWidth = getLockedViewportWidth()
      document.documentElement.style.width = `${clientWidth}px`
      document.body.style.width = `${clientWidth}px`
    }
  }

  function enableBodyScroll() {
    document.documentElement.style.width = scrollState.htmlWidth
    document.documentElement.style.overflow = scrollState.htmlOverflow
    scrollState.htmlOverflow = ''
    scrollState.htmlWidth = ''
    document.body.style.width = scrollState.bodyWidth
    document.body.style.overflow = scrollState.bodyOverflow
    scrollState.bodyOverflow = ''
    scrollState.bodyWidth = ''
    scrollState.lockedWidth = false
  }

  function handleMermaidClick(event: MouseEvent) {
    if (!allowTargetClick) return
    if (isExpandActive.value || options.isBlocked?.value) return
    const svg = options.getExpandTarget()
    if (!svg) return
    if (!svg.contains(event.target as Node)) return
    openExpand(event)
  }

  tryOnScopeDispose(() => {
    if (isClient) resetExpand()
  })

  return {
    setExpandTargetWrap,
    expandTargetStyle,
    isExpandActive,
    isVisible,
    openExpand,
    closeExpand,
    toggleExpand,
    handleExpandTransitionEnd,
    handleMermaidClick,
    resetExpand,
    zoom,
    showZoomHint,
  }
}
