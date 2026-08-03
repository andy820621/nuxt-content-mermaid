<script setup lang="ts">
import { computed } from 'vue'

const diagram = 'graph TD;A-->B;B-->C;'
const encoded = computed(() => encodeURIComponent(diagram))
</script>

<template>
  <div id="diagram-container">
    <Mermaid
      :code="encoded"
      :config="{ theme: 'dark' }"
      :toolbar="{ title: 'Built-in toolbar input' }"
    >
      <template #loading>
        Built-in loading slot
      </template>
      <template #error>
        Built-in error slot
      </template>
    </Mermaid>
  </div>
  <div id="slot-diagram">
    <Mermaid :code="encoded">
      <pre><code data-testid="renderer-slot-source">{{ diagram }}</code></pre>
    </Mermaid>
  </div>
</template>
