<script setup lang="ts">
import { computed } from 'vue'
import IconMinus from './icons/IconMinus.vue'
import IconPlus from './icons/IconPlus.vue'

const props = withDefaults(defineProps<{
  scale: number
  iconSize?: number
  iconScale?: number
  variant?: 'fullscreen' | 'overlay'
  resetLabel?: string
}>(), {
  iconSize: 18,
  iconScale: 1,
  variant: 'overlay',
  resetLabel: 'Reset',
})

const emit = defineEmits<{
  (e: 'zoom-in' | 'zoom-out' | 'reset'): void
}>()

const zoomIconSize = computed(() => {
  const base = typeof props.iconSize === 'number' ? props.iconSize : 18
  return Math.max(12, Math.round(base * props.iconScale))
})

const zoomPercent = computed(() => Math.round(props.scale * 100))
const isFullscreen = computed(() => props.variant === 'fullscreen')

const handleAction = (event: MouseEvent, action: 'zoom-in' | 'zoom-out' | 'reset') => {
  emit(action)
  ;(event.currentTarget as HTMLButtonElement | null)?.blur()
}
</script>

<template>
  <div
    class="ncm-zoom-toolbar"
    :class="{
      'ncm-zoom-toolbar--fullscreen': isFullscreen,
      'ncm-zoom-toolbar--overlay': !isFullscreen,
    }"
    @mousedown.stop
    @touchstart.stop
  >
    <button
      type="button"
      class="ncm-zoom-btn"
      aria-label="Zoom Out"
      @click.stop="handleAction($event, 'zoom-out')"
    >
      <IconMinus :size="zoomIconSize" />
    </button>
    <span class="ncm-zoom-info">{{ zoomPercent }}%</span>
    <button
      type="button"
      class="ncm-zoom-btn"
      aria-label="Zoom In"
      @click.stop="handleAction($event, 'zoom-in')"
    >
      <IconPlus :size="zoomIconSize" />
    </button>
    <span class="ncm-zoom-toolbar-separator">|</span>
    <button
      type="button"
      class="ncm-zoom-btn ncm-zoom-reset"
      aria-label="Reset Zoom"
      @click.stop="handleAction($event, 'reset')"
    >
      {{ resetLabel }}
    </button>
  </div>
</template>

<style scoped>
.ncm-zoom-toolbar {
  display: flex;
  align-items: center;
  gap: var(--ncm-zoom-gap, 4px);
  padding: var(--ncm-zoom-padding, 4px 8px);
  border-radius: var(--ncm-zoom-radius, 8px);
  border: 1px solid color-mix(in oklab, var(--ncm-text) 8%, transparent);
  background-color: color-mix(in oklab, var(--ncm-code-bg) 35%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: var(--ncm-zoom-font-size, 14px);
  pointer-events: auto;
}

.ncm-zoom-toolbar--overlay {
  position: absolute;
  top: 10px;
  right: 50px; /* Left of close button */
  z-index: 3;
  --ncm-zoom-font-size: 14px;
  --ncm-zoom-padding: 4px 8px;
}

.ncm-zoom-toolbar--fullscreen {
  position: fixed;
  top: calc(var(--ncm-toolbar-height, 37px) + 12px);
  right: 12px;
  z-index: 10;
  --ncm-zoom-font-size: 20px;
  --ncm-zoom-padding: 4px 12px;
  will-change: transform, opacity;
}

.ncm-zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  padding: var(--ncm-zoom-btn-padding, 3px 6px);
  border: none;
  background-color: transparent;
  color: color-mix(in oklab, var(--ncm-text) 55%, transparent);
  border-radius: var(--ncm-zoom-btn-radius, 6px);
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s, background-color 0.2s;
}

.ncm-zoom-btn:hover {
  color: var(--ncm-text);
  background-color: var(--ncm-code-bg-hover);
}

.ncm-zoom-info {
  color: color-mix(in oklab, var(--ncm-text) 60%, transparent);
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  user-select: none;
  font-size: 0.85em;
}

.ncm-zoom-reset {
  font-size: 0.85em;
  line-height: 1;
}

.ncm-zoom-btn:active {
  transform: translateY(1px);
  background-color: color-mix(in oklab, var(--ncm-text) 20%, transparent);
}

.ncm-zoom-toolbar-separator {
  margin: 0 .24rem;
  color: color-mix(in oklab, var(--ncm-text) 50%, transparent);
  user-select: none;
  transform: scaleY(.81);
}
</style>
