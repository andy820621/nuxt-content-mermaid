import { computed, nextTick, ref } from 'vue'
import type { CSSProperties, ComponentPublicInstance, Ref } from 'vue'
import type { ExpandOptions } from '../types/expand'
import { useMermaidZoom } from './useMermaidZoom'
import { useEventListener } from './useEventListener'
import { tryOnScopeDispose } from './shared/tryOnScopeDispose'

type ExpandState = 'idle' | 'opening' | 'open' | 'closing'

interface ExpandRect {
  top: number
  left: number
  width: number
  height: number
}

interface ExpandMetrics {
  coordinatePlane: ExpandRect
  sourceDiagram: ExpandRect
  sourceClip: ExpandRect
  expandedClip: ExpandRect
  translateX: number
  translateY: number
  scale: number
}

interface UseMermaidExpandOptions {
  getExpandTarget: () => SVGElement | null
  getExpandViewport: () => HTMLElement | null
  getInitialFocusTarget?: () => HTMLElement | null
  getReturnFocusTarget?: () => HTMLElement | null
  expandOptions: ExpandOptions
  isBlocked?: Ref<boolean>
}

const swipeToCloseThreshold = 10

export function useMermaidExpand(options: UseMermaidExpandOptions) {
  const isClient = typeof import.meta.client === 'boolean'
    ? import.meta.client
    : typeof window !== 'undefined' && typeof document !== 'undefined'
  const expandTargetWrap = ref<HTMLDivElement | null>(null)
  const expandModal = ref<HTMLDivElement | null>(null)
  const setExpandModal = (el: Element | ComponentPublicInstance | null) => {
    expandModal.value = el && 'nodeType' in el ? el as HTMLDivElement : null
  }
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
  const isVisible = computed(() => isExpanded.value)
  const allowTargetClick = options.expandOptions.invokeOpenOn?.diagramClick !== false
  const allowCloseByEsc = options.expandOptions.invokeCloseOn?.esc !== false
  const allowCloseByWheel = options.expandOptions.invokeCloseOn?.wheel !== false
  const allowCloseBySwipe = options.expandOptions.invokeCloseOn?.swipe !== false
  const allowOverlayClose = options.expandOptions.invokeCloseOn?.overlayClick !== false
  const allowCloseButton = options.expandOptions.invokeCloseOn?.closeButtonClick !== false

  const shouldDisableTransition = computed(() => shouldRefreshExpand.value || zoom.isPointerDown.value)

  const expandClipStyle = computed<CSSProperties>(() => {
    const metrics = expandMetrics.value
    if (!metrics) return {}

    const rect = isExpanded.value ? metrics.expandedClip : metrics.sourceClip
    return {
      top: `${metrics.coordinatePlane.top}px`,
      left: `${metrics.coordinatePlane.left}px`,
      width: `${metrics.coordinatePlane.width}px`,
      height: `${metrics.coordinatePlane.height}px`,
      clipPath: toClipPath(rect, metrics.coordinatePlane),
      transitionDuration: shouldDisableTransition.value ? '0ms' : undefined,
    }
  })

  const expandTargetStyle = computed<CSSProperties>(() => {
    const metrics = expandMetrics.value
    if (!metrics) return {}

    const { transform } = zoom.transformStyle.value

    return {
      top: `${metrics.sourceDiagram.top}px`,
      left: `${metrics.sourceDiagram.left}px`,
      width: `${metrics.sourceDiagram.width}px`,
      height: `${metrics.sourceDiagram.height}px`,
      transform: isExpanded.value
        ? transform
        : 'translate(0px, 0px) scale(1)',
      transitionDuration: shouldDisableTransition.value ? '0ms' : undefined,
    }
  })

  let expandTransitionTimeout: ReturnType<typeof setTimeout> | undefined
  let expandResizeTimeout: ReturnType<typeof setTimeout> | undefined
  let openingRaf: number | undefined

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
  let hasDeferredResize = false
  // Wait for UI transition to settle (e.g., keyboard, address bar, rotation)
  const resizeRefreshDelay = 180
  const scrollState = {
    bodyOverflow: '',
    bodyWidth: '',
    htmlOverflow: '',
    htmlWidth: '',
    scrollbarGutter: 0,
    layoutWidth: 0,
    lockedWidth: false,
    locked: false,
  }
  const touchState: { isScaling: boolean, start?: number, end?: number } = {
    isScaling: false,
  }
  let expandInstanceId = 0
  let focusLifecycleId = 0
  let returnFocusTarget: HTMLElement | null = null
  let shouldRestoreTriggerFocus = false

  function isUsableFocusTarget(target: HTMLElement | null) {
    if (!target?.isConnected || target.hidden || target.getAttribute('aria-hidden') === 'true') return false
    if ('disabled' in target && target.disabled) return false
    const style = window.getComputedStyle(target)
    return style.display !== 'none' && style.visibility !== 'hidden' && target.getClientRects().length > 0
  }

  function focusElement(target: HTMLElement | null) {
    if (!target || !isUsableFocusTarget(target)) return false
    target.focus({ preventScroll: true })
    return true
  }

  function resolveToolbarTrigger(event?: Event) {
    const target = event?.currentTarget as HTMLElement | null
    return target?.tagName === 'BUTTON' ? target : null
  }

  function focusExpandDialog(id: number) {
    nextTick(() => {
      if (id !== focusLifecycleId || !isExpandActive.value) return
      focusElement(options.getInitialFocusTarget?.() ?? expandModal.value)
    })
  }

  function restoreTriggerFocus() {
    const target = returnFocusTarget
    returnFocusTarget = null
    const shouldRestore = shouldRestoreTriggerFocus
    shouldRestoreTriggerFocus = false
    const id = ++focusLifecycleId
    if (!shouldRestore) return
    nextTick(() => {
      if (id !== focusLifecycleId || isExpandActive.value) return
      focusElement(options.getReturnFocusTarget?.() ?? target)
    })
  }

  function resolveExpandMargin() {
    const margin = options.expandOptions.margin
    if (typeof margin !== 'number' || Number.isNaN(margin)) return 0
    return Math.max(0, margin)
  }

  function getExpandCoordinateViewportSize() {
    // Keep the transition in the same content coordinate plane captured before
    // scroll lock. The overlay may grow into the scrollbar gutter, but changing
    // that plane mid-transition would move a centered diagram sideways.
    return {
      width: scrollState.locked && scrollState.layoutWidth > 0
        ? scrollState.layoutWidth
        : document.documentElement.clientWidth || window.innerWidth,
      height: window.innerHeight,
    }
  }

  function intersectRects(...rects: ExpandRect[]): ExpandRect | null {
    const left = Math.max(...rects.map(rect => rect.left))
    const top = Math.max(...rects.map(rect => rect.top))
    const right = Math.min(...rects.map(rect => rect.left + rect.width))
    const bottom = Math.min(...rects.map(rect => rect.top + rect.height))
    if (right <= left || bottom <= top) return null

    return {
      top,
      left,
      width: right - left,
      height: bottom - top,
    }
  }

  function toClipPath(rect: ExpandRect, plane: ExpandRect) {
    const top = Math.max(0, rect.top - plane.top)
    const left = Math.max(0, rect.left - plane.left)
    const right = Math.max(0, plane.width - left - rect.width)
    const bottom = Math.max(0, plane.height - top - rect.height)
    return `inset(${top}px ${right}px ${bottom}px ${left}px)`
  }

  function getLockedViewportWidth() {
    const width = document.documentElement.clientWidth || window.innerWidth
    return Math.max(1, Math.round(width))
  }

  function updateLockedWidth() {
    if (!scrollState.lockedWidth || document.body.style.overflow !== 'hidden') return

    const width = window.innerWidth
    const height = window.innerHeight
    const needsVerticalScrollbar = document.documentElement.scrollHeight > height
    const gutter = needsVerticalScrollbar ? scrollState.scrollbarGutter : 0
    const layoutWidth = Math.max(1, Math.round(width - gutter))
    scrollState.layoutWidth = layoutWidth
    document.documentElement.style.width = `${layoutWidth}px`
    document.body.style.width = `${layoutWidth}px`
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

  function clearOpeningRaf() {
    if (openingRaf != null) cancelAnimationFrame(openingRaf)
    openingRaf = undefined
  }

  function resetSwipeState() {
    touchState.isScaling = false
    touchState.start = undefined
    touchState.end = undefined
  }

  function cancelPendingWork() {
    clearTimeout(expandTransitionTimeout)
    clearTimeout(hintTimeout)
    expandTransitionTimeout = undefined
    hintTimeout = undefined
    clearResizeTimers()
    clearRefreshRaf()
    clearOpeningRaf()
    showZoomHint.value = false
    resetSwipeState()
    zoom.cancelInteraction()
  }

  function calculateExpandMetrics(target: SVGElement): ExpandMetrics | null {
    const sourceRect = target.getBoundingClientRect()
    if (!sourceRect.width || !sourceRect.height) return null

    const viewport = options.getExpandViewport()
    if (!viewport) return null
    const viewportRect = viewport.getBoundingClientRect()

    const margin = resolveExpandMargin()
    const { width, height } = getExpandCoordinateViewportSize()
    const coordinatePlane = { top: 0, left: 0, width, height }
    const viewportWidth = Math.max(1, width - margin * 2)
    const viewportHeight = Math.max(1, height - margin * 2)
    const sourceDiagram = {
      top: sourceRect.top,
      left: sourceRect.left,
      width: sourceRect.width,
      height: sourceRect.height,
    }
    const sourceViewport = {
      top: viewportRect.top + viewport.clientTop,
      left: viewportRect.left + viewport.clientLeft,
      width: viewport.clientWidth,
      height: viewport.clientHeight,
    }
    const sourceClip = intersectRects(
      sourceDiagram,
      sourceViewport,
      coordinatePlane,
    )
    if (!sourceClip) return null

    const expandedClip = {
      top: margin,
      left: margin,
      width: viewportWidth,
      height: viewportHeight,
    }
    const scaleX = viewportWidth / sourceRect.width
    const scaleY = viewportHeight / sourceRect.height
    const scale = Number.isFinite(scaleX) && Number.isFinite(scaleY)
      ? Math.min(scaleX, scaleY)
      : 1
    const safeScale = scale > 0 ? scale : 1

    return {
      coordinatePlane,
      sourceDiagram,
      sourceClip,
      expandedClip,
      translateX: expandedClip.left + (expandedClip.width - sourceRect.width * safeScale) / 2 - sourceDiagram.left,
      translateY: expandedClip.top + (expandedClip.height - sourceRect.height * safeScale) / 2 - sourceDiagram.top,
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
    cancelPendingWork()
    clearExpandSvg()
    expandState.value = 'idle'
    isExpanded.value = false
    shouldRefreshExpand.value = false
    hasDeferredResize = false
    showZoomHint.value = false
    expandMetrics.value = null
    enableBodyScroll()
    restoreTriggerFocus()
  }

  function openExpand(event?: Event) {
    if (!isClient || isExpandActive.value) return
    if (options.isBlocked?.value) return

    const svg = options.getExpandTarget()
    if (!svg) return

    const metrics = calculateExpandMetrics(svg)
    if (!metrics) return

    returnFocusTarget = resolveToolbarTrigger(event)
    shouldRestoreTriggerFocus = returnFocusTarget !== null
    const focusId = ++focusLifecycleId

    expandMetrics.value = metrics
    hasShownZoomHint = false // Reset hint flag for new expand

    // Init zoom state
    zoom.init({
      scale: metrics.scale,
      translateX: metrics.translateX,
      translateY: metrics.translateY,
      top: metrics.sourceDiagram.top,
      left: metrics.sourceDiagram.left,
    })

    expandState.value = 'opening'
    isExpanded.value = false
    disableBodyScroll()
    focusExpandDialog(focusId)

    nextTick(() => {
      if (expandState.value !== 'opening') return
      if (!mountExpandSvg(svg)) {
        resetExpand()
        return
      }

      // Give the teleported clone one painted source frame before applying its destination geometry.
      openingRaf = requestAnimationFrame(() => {
        if (expandState.value !== 'opening') {
          openingRaf = undefined
          return
        }
        openingRaf = requestAnimationFrame(() => {
          openingRaf = undefined
          if (expandState.value !== 'opening') return
          isExpanded.value = true
          ensureExpandTransitionEnd()
        })
      })
    })
  }

  function closeExpand(_event?: Event) {
    if (!isClient || !isExpandActive.value) return
    if (expandState.value === 'opening' && !expandTargetWrap.value) {
      resetExpand()
      return
    }
    cancelPendingWork()
    hasDeferredResize = false
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
    if (expandState.value === 'opening') finishOpening()
    else if (expandState.value === 'closing') resetExpand()
  }

  function finishOpening() {
    if (expandState.value !== 'opening') return
    clearTimeout(expandTransitionTimeout)
    expandTransitionTimeout = undefined
    expandState.value = 'open'
    if (!hasDeferredResize) return
    hasDeferredResize = false
    scheduleExpandRefresh()
  }

  function ensureExpandTransitionEnd() {
    if (!expandTargetWrap.value) return
    const duration = window.getComputedStyle(expandTargetWrap.value).transitionDuration
    const durationMs = Number.parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000)
    if (!durationMs) {
      if (expandState.value === 'opening') finishOpening()
      return
    }

    clearTimeout(expandTransitionTimeout)
    expandTransitionTimeout = setTimeout(() => {
      if (expandState.value === 'opening') finishOpening()
      else if (expandState.value === 'closing') resetExpand()
    }, durationMs + 50)
  }

  function handleExpandKeyDown(event: KeyboardEvent) {
    if (event.key === 'Tab') {
      containDialogFocus(event)
      return
    }

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

  function containDialogFocus(event: KeyboardEvent) {
    const modal = expandModal.value
    if (!modal) return
    const focusable = Array.from(modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(isUsableFocusTarget)

    if (!focusable.length) {
      event.preventDefault()
      focusElement(modal)
      return
    }

    const first = focusable[0]!
    const last = focusable.at(-1)!
    const active = document.activeElement
    if (event.shiftKey && (active === first || !modal.contains(active))) {
      event.preventDefault()
      focusElement(last)
    }
    else if (!event.shiftKey && (active === last || !modal.contains(active))) {
      event.preventDefault()
      focusElement(first)
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
    resetSwipeState()
  }

  function handleExpandTouchCancel() {
    if (!allowCloseBySwipe) return
    resetSwipeState()
  }

  function handleExpandResize() {
    if (expandState.value === 'opening') {
      hasDeferredResize = true
      return
    }
    if (expandState.value !== 'open') return
    scheduleExpandRefresh()
  }

  function hasSameRect(left: ExpandRect, right: ExpandRect) {
    return left.top === right.top
      && left.left === right.left
      && left.width === right.width
      && left.height === right.height
  }

  function hasSameExpandMetrics(left: ExpandMetrics, right: ExpandMetrics) {
    return hasSameRect(left.coordinatePlane, right.coordinatePlane)
      && hasSameRect(left.sourceDiagram, right.sourceDiagram)
      && hasSameRect(left.sourceClip, right.sourceClip)
      && hasSameRect(left.expandedClip, right.expandedClip)
      && left.translateX === right.translateX
      && left.translateY === right.translateY
      && left.scale === right.scale
  }

  function refreshExpandMetrics() {
    if (expandState.value !== 'open') return
    updateLockedWidth()

    const svg = options.getExpandTarget()
    if (!svg) return
    const metrics = calculateExpandMetrics(svg)
    if (!metrics) return
    if (expandMetrics.value && hasSameExpandMetrics(expandMetrics.value, metrics)) return
    expandMetrics.value = metrics

    // Re-init zoom on resize (Fit)
    zoom.init({
      scale: metrics.scale,
      translateX: metrics.translateX,
      translateY: metrics.translateY,
      top: metrics.sourceDiagram.top,
      left: metrics.sourceDiagram.left,
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
    const activeModal = computed(() => isExpandActive.value ? expandModal.value : null)
    const activeTarget = computed(() => isExpandActive.value ? expandTargetWrap.value : null)

    useEventListener(activeWindow, 'resize', handleExpandResize, { passive: true })
    useEventListener(activeWindow, 'orientationchange', handleExpandResize, { passive: true })
    useEventListener(activeVisualViewport, 'resize', handleExpandResize, { passive: true })
    useEventListener(activeWindow, 'wheel', handleExpandWheel, { passive: false })
    useEventListener(activeWindow, 'touchstart', handleExpandTouchStart, { passive: true })
    useEventListener(activeWindow, 'touchmove', handleExpandTouchMove, { passive: true })
    useEventListener(activeWindow, 'touchend', handleExpandTouchEnd, { passive: true })
    useEventListener(activeWindow, 'touchcancel', handleExpandTouchCancel, { passive: true })
    useEventListener(activeDocument, 'keydown', handleExpandKeyDown, true)
    useEventListener(activeModal, 'click', handleModalClick)
    useEventListener(activeModal, 'mousedown', zoom.handleDragStart)
    useEventListener(activeModal, 'mousemove', zoom.handleDragMove)
    useEventListener(activeModal, 'touchstart', zoom.handleDragStart)
    useEventListener(activeModal, 'touchmove', zoom.handleDragMove)
    useEventListener(activeModal, 'touchend', zoom.handleDragEnd)
    useEventListener(activeTarget, 'transitionend', handleExpandTransitionEnd)
  }

  function disableBodyScroll() {
    if (scrollState.locked) return
    scrollState.bodyOverflow = document.body.style.overflow
    scrollState.bodyWidth = document.body.style.width
    scrollState.htmlOverflow = document.documentElement.style.overflow
    scrollState.htmlWidth = document.documentElement.style.width
    const layoutWidth = getLockedViewportWidth()
    const viewportWidth = window.innerWidth
    scrollState.layoutWidth = layoutWidth
    scrollState.scrollbarGutter = Math.max(0, Math.round(viewportWidth - layoutWidth))
    scrollState.lockedWidth = scrollState.scrollbarGutter > 0
    scrollState.locked = true
    if (scrollState.lockedWidth) {
      document.documentElement.style.width = `${layoutWidth}px`
      document.body.style.width = `${layoutWidth}px`
    }
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
  }

  function enableBodyScroll() {
    if (!scrollState.locked) return
    document.documentElement.style.width = scrollState.htmlWidth
    document.documentElement.style.overflow = scrollState.htmlOverflow
    scrollState.htmlOverflow = ''
    scrollState.htmlWidth = ''
    document.body.style.width = scrollState.bodyWidth
    document.body.style.overflow = scrollState.bodyOverflow
    scrollState.bodyOverflow = ''
    scrollState.bodyWidth = ''
    scrollState.scrollbarGutter = 0
    scrollState.layoutWidth = 0
    scrollState.lockedWidth = false
    scrollState.locked = false
  }

  function handleMermaidClick(event: MouseEvent) {
    if (!allowTargetClick) return
    if (isExpandActive.value || options.isBlocked?.value) return
    const svg = options.getExpandTarget()
    if (!svg) return
    if (!svg.contains(event.target as Node)) return
    openExpand(event)
  }

  function handleModalClick(event: MouseEvent) {
    if (zoom.isSpacePressed.value) return
    if (zoom.wasLastInteractionDrag.value) {
      event.stopPropagation()
      return
    }

    const target = event.target as HTMLElement
    if (!target.classList?.contains('ncm-expand-overlay') && !target.classList?.contains('ncm-expand-modal')) return
    if (allowOverlayClose) closeExpand(event)
  }

  function closeFromButton(event?: Event) {
    if (allowCloseButton) closeExpand(event)
  }

  function endForDiagramReplacement() {
    if (isExpandActive.value) resetExpand()
  }

  tryOnScopeDispose(() => {
    if (isClient) resetExpand()
  })

  return {
    setExpandModal,
    setExpandTargetWrap,
    expandClipStyle,
    expandTargetStyle,
    isExpandActive,
    isVisible,
    toggle: toggleExpand,
    openFromDiagram: handleMermaidClick,
    endForDiagramReplacement,
    closeFromButton,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    resetZoom: zoom.reset,
    cursor: computed(() => zoom.cursor.value),
    isDragging: computed(() => zoom.isDragging.value),
    scale: computed(() => zoom.scale.value),
    isOverlayClosable: computed(() => allowOverlayClose && !zoom.isSpacePressed.value),
    showZoomHint,
  }
}
