<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  error: unknown
  source: string
}>()

const errorMessage = computed(() => {
  if (props.error instanceof Error) return props.error.message
  return String(props.error ?? 'Unknown error')
})
</script>

<template>
  <div
    id="test-error"
    data-testid="custom-error"
  >
    <div class="error-header">
      ❌ Custom Error Component
    </div>
    <div class="error-message">
      {{ errorMessage }}
    </div>
    <details class="error-source">
      <summary>Mermaid Definition</summary>
      <pre><code>{{ source }}</code></pre>
    </details>
  </div>
</template>

<style scoped>
.error-header {
  padding: 12px;
  background: #fee2e2;
  border-bottom: 2px solid #dc2626;
  font-weight: bold;
  color: #dc2626;
}
.error-message {
  padding: 12px;
  color: #991b1b;
  font-size: 14px;
}
.error-source {
  padding: 12px;
  border-top: 1px solid #fecaca;
}
.error-source pre {
  background: #fef2f2;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}
</style>
