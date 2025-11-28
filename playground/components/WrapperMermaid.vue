<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(defineProps<{
  title?: string
  code?: string
  spinner?: Component | string
}>(), {
  code: '',
})
</script>

<template>
  <section class="wrapper-mermaid">
    <header
      v-if="title"
      class="wrapper-mermaid__header"
    >
      {{ title }}
    </header>

    <Mermaid>
      <!-- default slot: can be overridden by external slot, falls back to code prop if not provided -->
      <slot>
        <pre><code>{{ code }}</code></pre>
      </slot>

      <!-- loading slot: use spinner if provided, otherwise show text -->
      <template #loading>
        <component
          :is="spinner"
          v-if="spinner"
        />
        <div
          v-else
          class="wrapper-mermaid__loading"
        >
          Diagram loading…
        </div>
      </template>

      <!-- error slot: display error message and original mermaid definition -->
      <template #error="{ error, source }">
        <div class="wrapper-mermaid__error">
          <p>Mermaid rendering failed: {{ error instanceof Error ? error.message : String(error ?? 'Unknown error') }}</p>
          <details open>
            <summary style="margin-bottom: 1rem;">
              View original mermaid definition
            </summary>
            <pre><code>{{ source }}</code></pre>
          </details>
        </div>
      </template>
    </Mermaid>
  </section>
</template>

<style scoped>
.wrapper-mermaid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wrapper-mermaid__header {
  font-weight: 600;
}

.wrapper-mermaid__loading {
  text-align: center;
  color: #475569;
  font-size: 14px;
}

.wrapper-mermaid__error {
  color: #b91c1c;
  font-size: 14px;
  line-height: 1.5;
}

/* Override :deep(pre/code) hiding rules in Mermaid.vue to ensure error block shows original code */
pre, code {
  opacity: 1 !important;
  pointer-events: auto !important;
  user-select: text !important;
  max-height: none !important;
  overflow: auto !important;
}

pre {
  background: #f8fafc;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}
</style>
