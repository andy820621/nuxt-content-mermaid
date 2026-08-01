<script setup lang="ts">
import { computed } from 'vue'
import type { MermaidTestWindow } from '../types'

const props = defineProps<{
  error: unknown
  source: string
}>()

const errorMessage = computed(() => {
  return props.error instanceof Error ? props.error.message : String(props.error)
})
const preservesIdentity = computed(() => {
  return import.meta.client
    && props.error === (window as MermaidTestWindow).__mermaidControl__?.lastError
})
</script>

<template>
  <div
    data-testid="built-in-error"
    :data-same-error="String(preservesIdentity)"
  >
    <span data-testid="built-in-error-message">{{ errorMessage }}</span>
    <code data-testid="built-in-error-source">{{ source }}</code>
  </div>
</template>
