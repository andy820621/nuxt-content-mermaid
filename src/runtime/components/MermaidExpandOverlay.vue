<script setup lang="ts">
import type { CSSProperties, ComponentPublicInstance } from 'vue'
import type { MermaidZoomReturn } from '../composables/useMermaidZoom'

const props = defineProps<{
  active: boolean
  isVisable: boolean
  overlayStyle?: CSSProperties
  contentStyle?: CSSProperties
  targetStyle?: CSSProperties
  targetRef: (el: Element | ComponentPublicInstance | null) => void
  allowOverlayClose: boolean
  allowCloseButton: boolean
  targetHasMargin: boolean
  iconSize?: number
  zoom?: MermaidZoomReturn
  showHint?: boolean
}>()

const isMac = import.meta.client ? /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) : false

const emit = defineEmits<{
  (e: 'close', event?: Event): void
  (e: 'transitionend', event: TransitionEvent): void
}>()

const handleButtonClick = (event: MouseEvent) => {
  if (!props.allowCloseButton) return
  emit('close', event)
}

// Handler for Modal Click (captures everything)
const handleModalClick = (event: MouseEvent) => {
  // Check explicit drag flag
  if (props.zoom?.isSpacePressed.value) return
  if (props.zoom?.wasLastInteractionDrag.value) {
    event.stopPropagation()
    return
  }

  // If it wasn't a drag, check where we clicked.
  // If we clicked on the overlay element (background), try to close.
  const target = event.target as HTMLElement
  if (target.classList.contains('ncm-expand-overlay') || target.classList.contains('ncm-expand-modal')) {
    if (props.allowOverlayClose) {
      emit('close', event)
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="ncm-expand-modal"
      :style="{
        cursor: zoom?.cursor.value || 'auto',
      }"
      @click="handleModalClick"
      @mousedown="zoom?.handleDragStart($event)"
      @mousemove="zoom?.handleDragMove($event)"
      @touchstart="zoom?.handleDragStart($event)"
      @touchmove="zoom?.handleDragMove($event)"
      @touchend="zoom?.handleDragEnd()"
    >
      <div
        class="ncm-expand-overlay"
        :style="overlayStyle"
        :class="{
          'ncm-expand-overlay-visible': isVisable,
          'ncm-expand-overlay-closable': allowOverlayClose && !zoom?.isSpacePressed.value,
          'ncm-expand-dragging': zoom?.isDragging.value,
        }"
      />
      <div
        class="ncm-expand-content"
        :style="contentStyle"
      >
        <div
          :ref="targetRef"
          class="ncm-expand-target"
          :class="{
            'ncm-expand-target-with-margin': targetHasMargin,
          }"
          :style="targetStyle"
          @transitionend="emit('transitionend', $event)"
        />

        <!-- Zoom Toolbar -->
        <div
          v-if="zoom"
          class="ncm-zoom-toolbar"
          @mousedown.stop
          @touchstart.stop
        >
          <button
            class="ncm-zoom-btn"
            aria-label="Zoom Out"
            @click.stop="zoom.zoomOut(); ($event.currentTarget as HTMLButtonElement).blur()"
          >
            -
          </button>
          <span class="ncm-zoom-info">{{ Math.round(zoom.scale.value * 100) }}%</span>
          <button
            class="ncm-zoom-btn"
            aria-label="Zoom In"
            @click.stop="zoom.zoomIn(); ($event.currentTarget as HTMLButtonElement).blur()"
          >
            +
          </button>
          <button
            class="ncm-zoom-btn ncm-zoom-reset"
            aria-label="Reset Zoom"
            @click.stop="zoom.reset(); ($event.currentTarget as HTMLButtonElement).blur()"
          >
            Reset
          </button>
        </div>

        <!-- Zoom Hint Toast -->
        <Transition name="ncm-hint-fade">
          <div
            v-if="showHint"
            class="ncm-zoom-hint"
          >
            {{ isMac ? '⌘' : 'Ctrl' }} + Scroll to zoom
          </div>
        </Transition>

        <button
          v-if="allowCloseButton"
          type="button"
          class="ncm-expand-btn"
          aria-label="Minimize diagram"
          @click="handleButtonClick"
          @mousedown.stop
          @touchstart.stop
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            :width="iconSize || 22"
            :height="iconSize || 22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line
              x1="14"
              y1="10"
              x2="21"
              y2="3"
            />
            <line
              x1="3"
              y1="21"
              x2="10"
              y2="14"
            />
          </svg>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ncm-expand-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  touch-action: none; /* Important for drag */
}
.ncm-expand-overlay {
  position: absolute;
  inset: 0;
  background-color: transparent;
  transition: background-color 0.3s, opacity 0.3s, backdrop-filter 0.3s;
  z-index: 0;
}
.ncm-expand-overlay.ncm-expand-overlay-visible {
  background-color: color-mix(in oklab, var(--ncm-overlay-bg, var(--ncm-code-bg, #fff)) 95%, var(--ncm-text) 5%);
  backdrop-filter: var(--ncm-overlay-backdrop, none);
  opacity: var(--ncm-overlay-opacity, 1);
}
.ncm-expand-overlay-closable {
  cursor: var(--ncm-cursor-collapse);
}
.ncm-expand-dragging {
  cursor: grabbing !important;
  user-select: none;
}
.ncm-expand-content {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.ncm-expand-target {
  position: absolute;
  transform-origin: top left;
  transition: transform 0.3s;
  cursor: inherit;
  pointer-events: auto;
  z-index: 2;
}

.ncm-expand-target.ncm-expand-target-with-margin {
  background-color: var(--ncm-expand-target-bg, color-mix(in oklab, var(--ncm-overlay-bg, var(--ncm-code-bg, #fff)) 90%, var(--ncm-code-bg, #fff) 10%));
  border-radius: 8px;
}
.ncm-expand-target :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
/* We set pointer-events: auto on target div */

.ncm-expand-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 6px;
  border-radius: 4px;
  border: none;
  background-color: var(--ncm-code-bg);
  color: var(--ncm-text-xmuted);
  border: var(--ncm-border);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background-color 0.2s;
}
.ncm-expand-btn:hover {
  color: var(--ncm-text);
  background-color: var(--ncm-code-bg-hover);
}

/* Zoom Toolbar */
.ncm-zoom-toolbar {
  position: absolute;
  top: 10px;
  right: 50px; /* Left of close button */
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: var(--ncm-code-bg);
  padding: 4px 8px;
  border-radius: 6px;
  border: var(--ncm-border);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  pointer-events: auto;
  z-index: 3;
}

.ncm-zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border: none;
  background-color: transparent;
  color: var(--ncm-text-xmuted);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s, background-color 0.2s;
}

.ncm-zoom-btn:hover {
  color: var(--ncm-text);
  background-color: var(--ncm-code-bg-hover);
}

.ncm-zoom-info {
  font-size: 12px;
  color: var(--ncm-text-muted);
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  user-select: none;
}
.ncm-zoom-reset {
    font-size: 12px;
}

/* Zoom Hint Toast */
.ncm-zoom-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 12px 24px;
  background-color: var(--ncm-hint-bg, rgba(0, 0, 0, 0.75));
  color: var(--ncm-hint-text, #fff);
  border-radius: var(--ncm-hint-radius, 8px);
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
  user-select: none;
  z-index: 10;
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
  .ncm-expand-overlay,
  .ncm-expand-target,
  .ncm-hint-fade-enter-active,
  .ncm-hint-fade-leave-active {
    transition-duration: 0.01ms !important;
  }
}
</style>
