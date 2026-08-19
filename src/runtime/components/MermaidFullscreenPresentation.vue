<script setup lang="ts">
import { watch } from 'vue'
import { useMermaidFullscreen } from '../composables/useMermaidFullscreen'
import MermaidZoomToolbar from './MermaidZoomToolbar.vue'
import type { MermaidToolbarLabels } from '../../types/mermaid'

const props = defineProps<{
  fullscreenTarget: HTMLElement | null
  viewportTarget: HTMLElement | null
  renderTarget: HTMLElement | null
  iconSize?: number
  labels: Required<MermaidToolbarLabels>
  getFocusTarget: () => HTMLElement | null
}>()

const emit = defineEmits<{
  (e: 'active-change' | 'supported-change', value: boolean): void
}>()

const isMac = import.meta.client ? /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) : false
const {
  isSupported,
  isActive,
  scale,
  showZoomHint,
  toggle,
  endForDiagramReplacement,
  zoomIn,
  zoomOut,
  resetZoom,
} = useMermaidFullscreen({
  getFullscreenTarget: () => props.fullscreenTarget,
  getViewportTarget: () => props.viewportTarget,
  getRenderTarget: () => props.renderTarget,
  getFocusTarget: props.getFocusTarget,
})

watch(isActive, active => emit('active-change', active), { flush: 'sync', immediate: true })
watch(isSupported, supported => emit('supported-change', supported), { flush: 'sync', immediate: true })

defineExpose({ toggle, endForDiagramReplacement })
</script>

<template>
  <MermaidZoomToolbar
    v-if="isActive"
    variant="fullscreen"
    :scale="scale"
    :icon-size="iconSize"
    :labels="labels"
    @zoom-out="zoomOut"
    @zoom-in="zoomIn"
    @reset="resetZoom"
  />

  <Transition name="ncm-hint-fade">
    <div
      v-if="showZoomHint && isActive"
      class="ncm-fullscreen-zoom-hint"
    >
      {{ isMac ? '⌘' : 'Ctrl' }} + Scroll to zoom
    </div>
  </Transition>
</template>

<style scoped>
.ncm-fullscreen-zoom-hint {
  display: none;
}

:fullscreen .ncm-fullscreen-zoom-hint {
  display: block;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 12px 24px;
  background-color: var(--ncm-hint-bg, rgba(0, 0, 0, 0.75));
  color: var(--ncm-hint-text, #fff);
  border-radius: var(--ncm-hint-radius, 8px);
  font-size: 20px;
  font-weight: 500;
  pointer-events: none;
  user-select: none;
  z-index: 20;
  white-space: nowrap;
}

.ncm-hint-fade-enter-active,
.ncm-hint-fade-leave-active {
  transition: opacity 0.2s ease;
}
.ncm-hint-fade-enter-from,
.ncm-hint-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .ncm-hint-fade-enter-active,
  .ncm-hint-fade-leave-active {
    transition-duration: 0.01ms !important;
  }
}
</style>
