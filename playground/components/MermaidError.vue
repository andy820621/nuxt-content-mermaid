<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  error: unknown
  source: string
}>()

const message = computed(() => {
  if (props.error instanceof Error)
    return props.error.message
  return String(props.error ?? 'Unknown error')
})
</script>

<template>
  <div class="mermaid-error">
    <p>Mermaid rendering failed: {{ message }}</p>

    <details>
      <summary>View original mermaid definition</summary>
      <pre><code>{{ source }}</code></pre>
    </details>
  </div>
</template>

<style scoped>
.mermaid-error {
  color: #b91c1c;
  font-size: 14px;
  line-height: 1.5;
}
pre, code {
  opacity: 1 !important;
  pointer-events: auto !important;
  user-select: text !important;
  max-height: initial !important;
  margin: auto !important;
  overflow: auto !important;
}
</style>
