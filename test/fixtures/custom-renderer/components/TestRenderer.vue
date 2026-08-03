<script setup lang="ts">
import { ref, onMounted, useAttrs, useSlots } from 'vue'
import type { Component } from 'vue'
import './renderer-resolution-control'

declare global {
  interface Window {
    __customRendererFailureMode__?: 'mount'
  }
}

defineProps<{
  code?: string
  spinner?: Component
}>()
defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const slots = useSlots()

const isLoading = ref(true)

onMounted(() => {
  if (window.__customRendererFailureMode__ === 'mount')
    throw new Error('Custom Renderer mount failed')

  setTimeout(() => {
    isLoading.value = false
  }, 300)
})
</script>

<template>
  <div>
    <component
      :is="spinner"
      v-if="isLoading"
      data-testid="renderer-spinner"
    />
    <div
      v-else
      id="test-renderer"
      data-testid="renderer-output"
    >
      Rendered: {{ code }}
      <span data-testid="renderer-attrs">{{ Object.keys(attrs).sort().join(',') }}</span>
      <span data-testid="renderer-slots">{{ Object.keys(slots).sort().join(',') }}</span>
      <slot />
    </div>
  </div>
</template>
