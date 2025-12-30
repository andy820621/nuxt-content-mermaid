import { computed, type Ref, type MaybeRef, toValue } from 'vue'

export function useMermaidCursors(iconSize: Ref<number>, enabled: MaybeRef<boolean>) {
  const buildCursorSvg = (size: number, paths: string) => {
    const outerWidth = Math.max(2, Math.round(size / 8))
    const innerWidth = Math.max(1, outerWidth - 1)
    return `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'><g stroke='black' stroke-width='${outerWidth}'>${paths}</g><g stroke='white' stroke-width='${innerWidth}'>${paths}</g></svg>`
  }

  const cursorExpandUri = computed(() => {
    const size = iconSize.value
    const svg = buildCursorSvg(
      size,
      '<polyline points=\'15 3 21 3 21 9\'/><polyline points=\'9 21 3 21 3 15\'/><line x1=\'21\' y1=\'3\' x2=\'14\' y2=\'10\'/><line x1=\'3\' y1=\'21\' x2=\'10\' y2=\'14\'/>',
    )
    const encoded = encodeURIComponent(svg)
    const hotspot = Math.round(size / 2)
    return `url("data:image/svg+xml,${encoded}") ${hotspot} ${hotspot}, zoom-in`
  })

  const cursorCollapseUri = computed(() => {
    const size = iconSize.value
    const svg = buildCursorSvg(
      size,
      '<polyline points=\'4 14 10 14 10 20\'/><polyline points=\'20 10 14 10 14 4\'/><line x1=\'14\' y1=\'10\' x2=\'21\' y2=\'3\'/><line x1=\'3\' y1=\'21\' x2=\'10\' y2=\'14\'/>',
    )
    const encoded = encodeURIComponent(svg)
    const hotspot = Math.round(size / 2)
    return `url("data:image/svg+xml,${encoded}") ${hotspot} ${hotspot}, zoom-out`
  })

  const cursorVariables = computed(() => {
    const isEnabled = toValue(enabled)
    if (!isEnabled) return {}
    return {
      '--ncm-cursor-expand': cursorExpandUri.value,
      '--ncm-cursor-collapse': cursorCollapseUri.value,
    }
  })

  return {
    cursorVariables,
    cursorExpandUri,
    cursorCollapseUri,
  }
}
