<script setup lang="ts">
import type { CSSProperties, ComponentPublicInstance } from 'vue'

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
}>()

const emit = defineEmits<{
  (e: 'close', event?: Event): void
  (e: 'transitionend', event: TransitionEvent): void
}>()

const handleOverlayClick = (event: MouseEvent) => {
  if (!props.allowOverlayClose) return
  emit('close', event)
}

const handleButtonClick = (event: MouseEvent) => {
  if (!props.allowCloseButton) return
  emit('close', event)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="ncm-expand-modal"
    >
      <div
        class="ncm-expand-overlay"
        :style="overlayStyle"
        :class="{
          'ncm-expand-overlay-visible': isVisable,
          'ncm-expand-overlay-closable': allowOverlayClose,
        }"
        @click="handleOverlayClick"
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
        <button
          v-if="allowCloseButton"
          type="button"
          class="ncm-expand-btn"
          aria-label="Minimize diagram"
          @click="handleButtonClick"
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
  cursor: default;
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

@media (prefers-reduced-motion: reduce) {
  .ncm-expand-overlay,
  .ncm-expand-target {
    transition-duration: 0.01ms !important;
  }
}
</style>
