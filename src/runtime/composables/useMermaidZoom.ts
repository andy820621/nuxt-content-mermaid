import { computed, ref, watch, type Ref } from 'vue'
import { useEventListener } from './useEventListener'

export interface ZoomMetrics {
  scale: number
  translateX: number
  translateY: number
  top?: number
  left?: number
}

export interface UseMermaidZoomOptions {
  active?: Ref<boolean>
  minScale?: number
  maxScale?: number
  zoomSpeed?: number
}

export function useMermaidZoom(options: UseMermaidZoomOptions = {}) {
  const {
    active = ref(true),
    minScale = 0.5,
    maxScale = 5,
    zoomSpeed = 0.1,
  } = options

  const scale = ref(1)
  const translateX = ref(0)
  const translateY = ref(0)
  const isDragging = ref(false)
  const isPointerDown = ref(false)
  const isSpacePressed = ref(false)
  const userSelectState = {
    html: '',
    body: '',
    locked: false,
  }

  // Interaction tracking
  const wasLastInteractionDrag = ref(false)
  let totalMovement = 0

  // Store initial state for reset
  const initialMetrics = ref<ZoomMetrics>({ scale: 1, translateX: 0, translateY: 0 })
  // Store the element's base position
  const origin = ref({ x: 0, y: 0 })

  const transformStyle = computed(() => {
    return {
      transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
    }
  })

  // Dynamic cursor state
  const cursor = computed(() => {
    if (isDragging.value) return 'grabbing'
    if (isSpacePressed.value) return 'grab'
    return 'auto'
  })

  function lockUserSelect() {
    if (!import.meta.client) return
    if (userSelectState.locked) return
    userSelectState.html = document.documentElement.style.userSelect
    userSelectState.body = document.body.style.userSelect
    document.documentElement.style.userSelect = 'none'
    document.body.style.userSelect = 'none'
    userSelectState.locked = true
  }

  function unlockUserSelect() {
    if (!import.meta.client) return
    if (!userSelectState.locked) return
    document.documentElement.style.userSelect = userSelectState.html
    document.body.style.userSelect = userSelectState.body
    userSelectState.html = ''
    userSelectState.body = ''
    userSelectState.locked = false
  }

  function init(metrics: ZoomMetrics) {
    initialMetrics.value = { ...metrics }
    origin.value = { x: metrics.left || 0, y: metrics.top || 0 }
    // Reset states
    isDragging.value = false
    isPointerDown.value = false
    isSpacePressed.value = false
    wasLastInteractionDrag.value = false
    totalMovement = 0
    unlockUserSelect()
    setMetrics(metrics)
  }

  function setMetrics(metrics: ZoomMetrics) {
    scale.value = metrics.scale
    translateX.value = metrics.translateX
    translateY.value = metrics.translateY
    if (metrics.left !== undefined) origin.value.x = metrics.left
    if (metrics.top !== undefined) origin.value.y = metrics.top
  }

  function reset() {
    setMetrics(initialMetrics.value)
  }

  function clampScale(s: number) {
    return Math.min(Math.max(s, minScale), maxScale)
  }

  function zoomTo(newScale: number, center?: { x: number, y: number }) {
    const s = clampScale(newScale)
    if (s === scale.value) return

    if (!center) {
      // Zoom to center of viewport
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      center = { x: viewportWidth / 2, y: viewportHeight / 2 }
    }

    const factor = s / scale.value

    // Adjusted math: T_new = (Center - Origin) * (1 - f) + T_old * f
    const ox = origin.value.x
    const oy = origin.value.y

    translateX.value = (center.x - ox) * (1 - factor) + translateX.value * factor
    translateY.value = (center.y - oy) * (1 - factor) + translateY.value * factor

    scale.value = s
  }

  function zoomIn() {
    zoomTo(scale.value * (1 + 0.25))
  }

  function zoomOut() {
    zoomTo(scale.value * (1 - 0.25))
  }

  function endInteraction() {
    if (!isPointerDown.value && !isDragging.value) return
    handleDragEnd()
  }

  // --- Global Listeners (Managed) ---

  if (import.meta.client) {
    // Elegant toggle: When active is false, target becomes null, listener is removed.
    const activeDocument = computed(() => active.value ? document : null)
    const activeWindow = computed(() => active.value ? window : null)

    watch(active, (isActive) => {
      if (isActive) return
      isSpacePressed.value = false
      unlockUserSelect()
      endInteraction()
    })

    useEventListener(activeDocument, 'keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (e.repeat) return
        // Prevent default to stop scrolling when in modal
        e.preventDefault()

        isSpacePressed.value = true
        lockUserSelect()
      }
    })

    useEventListener(activeDocument, 'keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        isSpacePressed.value = false
        unlockUserSelect()
        endInteraction()
      }
    })

    // Global pointer up to catch releases outside the overlay
    useEventListener(activeWindow, 'pointerup', () => {
      endInteraction()
    })

    useEventListener(activeWindow, 'pointercancel', () => {
      endInteraction()
    })

    useEventListener(activeWindow, 'blur', () => {
      if (isSpacePressed.value) {
        isSpacePressed.value = false
        unlockUserSelect()
      }
      endInteraction()
    })
  }

  // --- Event Handlers ---

  function handleWheel(event: WheelEvent): boolean {
    // Only Zoom if Ctrl/Meta is pressed
    if (!event.ctrlKey && !event.metaKey) return false

    event.preventDefault()
    event.stopPropagation()

    const delta = event.deltaY
    const speedFactor = zoomSpeed * 0.05
    const zoomFactor = Math.pow(1 - speedFactor, delta)

    zoomTo(scale.value * zoomFactor, { x: event.clientX, y: event.clientY })
    return true
  }

  // Drag State
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastY = 0
  let lastPinchDist = -1
  let wasPinching = false

  function getDistance(t1: Touch, t2: Touch) {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.hypot(dx, dy)
  }

  function getCenter(t1: Touch, t2: Touch) {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    }
  }

  function handleDragStart(event: MouseEvent | TouchEvent) {
    const isTouch = 'touches' in event

    // Reset interaction state at the start of any potential gesture
    wasLastInteractionDrag.value = false
    totalMovement = 0
    wasPinching = false

    // Mouse: Only Allow if Space is pressed
    if (!isTouch && !isSpacePressed.value) return
    if (!isTouch) event.preventDefault()

    // Pinch Start
    if (isTouch && (event as TouchEvent).touches.length >= 2) {
      const t1 = (event as TouchEvent).touches[0]
      const t2 = (event as TouchEvent).touches[1]
      if (t1 && t2) {
        lastPinchDist = getDistance(t1, t2)
        // Pinching is a manipulation. We treat it as "dragging" for the purpose
        // of preventing click-close.
        wasLastInteractionDrag.value = true
        wasPinching = true
        isDragging.value = false
        isPointerDown.value = true
        return
      }
    }

    // Pan Start
    isPointerDown.value = true
    isDragging.value = false

    const touch = 'touches' in event ? (event as TouchEvent).touches[0] : event as MouseEvent
    if (!touch) return

    startX = touch.clientX
    startY = touch.clientY
    lastX = startX
    lastY = startY
  }

  function handleDragMove(event: MouseEvent | TouchEvent) {
    if (!isPointerDown.value) return

    const isTouch = 'touches' in event

    // Pinch Move
    if (isTouch && (event as TouchEvent).touches.length >= 2) {
      if (lastPinchDist <= 0) return
      event.preventDefault()

      const t1 = (event as TouchEvent).touches[0]
      const t2 = (event as TouchEvent).touches[1]

      if (t1 && t2) {
        const dist = getDistance(t1, t2)
        const center = getCenter(t1, t2)

        if (dist > 0) {
          const factor = dist / lastPinchDist
          zoomTo(scale.value * factor, center)
          lastPinchDist = dist
        }
      }
      return
    }

    const touch = 'touches' in event ? (event as TouchEvent).touches[0] : event as MouseEvent
    if (!touch) return

    const dx = touch.clientX - lastX
    const dy = touch.clientY - lastY

    // Track total movement to distinguish click vs drag
    const totalDx = touch.clientX - startX
    const totalDy = touch.clientY - startY
    totalMovement = Math.hypot(totalDx, totalDy)

    // Check threshold for "Dragging" state
    if (!isDragging.value) {
      if (totalMovement > 5) {
        isDragging.value = true
      }
    }

    if (isDragging.value) {
      translateX.value += dx
      translateY.value += dy
      event.preventDefault()
    }

    lastX = touch.clientX
    lastY = touch.clientY
  }

  function handleDragEnd() {
    isPointerDown.value = false
    lastPinchDist = -1

    // Determine if it was a drag based on movement and state
    wasLastInteractionDrag.value = isDragging.value || totalMovement > 5 || wasPinching

    isDragging.value = false
  }

  return {
    scale,
    translateX,
    translateY,
    transformStyle,
    isDragging,
    isSpacePressed,
    wasLastInteractionDrag,
    cursor,
    init,
    reset,
    zoomIn,
    zoomOut,
    setMetrics,
    handleWheel,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    isPointerDown,
  }
}

export type MermaidZoomReturn = ReturnType<typeof useMermaidZoom>
