import { computed, nextTick, onUnmounted, ref } from 'vue'
import type { CSSProperties, ComponentPublicInstance, Ref } from 'vue'
import type { ExpandInvokeCloseOn, ExpandInvokeOpenOn } from '../types/expand'

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
  const shouldRefreshExpand = ref(false)

  const isExpandActive = computed(() => expandState.value !== 'idle')
  const isVisible = computed(() => expandState.value === 'open')
  const allowTargetClick = options.invokeOpenOn?.diagramClick !== false
  const allowCloseByEsc = options.invokeCloseOn?.esc !== false
  const allowCloseByWheel = options.invokeCloseOn?.wheel !== false
  const allowCloseBySwipe = options.invokeCloseOn?.swipe !== false

  const expandTargetStyle = computed<CSSProperties>(() => {
    const metrics = expandMetrics.value
    if (!metrics) return {}

    return {
      top: `${metrics.top}px`,
      left: `${metrics.left}px`,
      width: `${metrics.width}px`,
      height: `${metrics.height}px`,
      transform: isExpanded.value
        ? `translate(${metrics.translateX}px, ${metrics.translateY}px) scale(${metrics.scale})`
        : 'translate(0px, 0px) scale(1)',
      transitionDuration: shouldRefreshExpand.value ? '0.01ms' : undefined,
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
    if (!import.meta.client) return
    clearTimeout(expandTransitionTimeout)
    clearResizeTimers()
    clearRefreshRaf()
    clearExpandSvg()
    expandState.value = 'idle'
    isExpanded.value = false
    shouldRefreshExpand.value = false
    expandMetrics.value = null
    removeExpandListeners()
    enableBodyScroll()
  }

  function openExpand(_event?: Event) {
    if (!import.meta.client || isExpandActive.value) return
    if (options.isBlocked?.value) return

    const svg = options.getExpandTarget()
    if (!svg) return

    const metrics = calculateExpandMetrics(svg)
    if (!metrics) return

    expandMetrics.value = metrics
    expandState.value = 'opening'
    isExpanded.value = false
    disableBodyScroll()
    addExpandListeners()

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
    if (!import.meta.client || !isExpandActive.value) return
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
    if (!allowCloseByEsc) return
    if (event.key === 'Escape' || event.keyCode === 27) {
      event.preventDefault()
      event.stopPropagation()
      closeExpand(event)
    }
  }

  function handleExpandWheel(event: WheelEvent) {
    if (!allowCloseByWheel) return
    if (event.ctrlKey) return
    event.preventDefault()
    event.stopPropagation()
    queueMicrotask(() => closeExpand(event))
  }

  function handleExpandTouchStart(event: TouchEvent) {
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

  function addExpandListeners() {
    window.addEventListener('resize', handleExpandResize, { passive: true })
    window.addEventListener('orientationchange', handleExpandResize, { passive: true })
    window.visualViewport?.addEventListener('resize', handleExpandResize, { passive: true })
    window.addEventListener('wheel', handleExpandWheel, { passive: false })
    window.addEventListener('touchstart', handleExpandTouchStart, { passive: true })
    window.addEventListener('touchmove', handleExpandTouchMove, { passive: true })
    window.addEventListener('touchend', handleExpandTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleExpandTouchCancel, { passive: true })
    document.addEventListener('keydown', handleExpandKeyDown, true)
  }

  function removeExpandListeners() {
    window.removeEventListener('resize', handleExpandResize)
    window.removeEventListener('orientationchange', handleExpandResize)
    window.visualViewport?.removeEventListener('resize', handleExpandResize)
    window.removeEventListener('wheel', handleExpandWheel)
    window.removeEventListener('touchstart', handleExpandTouchStart)
    window.removeEventListener('touchmove', handleExpandTouchMove)
    window.removeEventListener('touchend', handleExpandTouchEnd)
    window.removeEventListener('touchcancel', handleExpandTouchCancel)
    document.removeEventListener('keydown', handleExpandKeyDown, true)
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

  onUnmounted(() => {
    if (import.meta.client) resetExpand()
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
  }
}
