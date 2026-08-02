<script setup lang="ts">
import { computed, ref } from 'vue'

const code = 'graph TD;A-->B;B-->C;'
const encoded = computed(() => encodeURIComponent(code))
const showDiagram = ref(true)
</script>

<template>
  <button
    id="unmount-diagram"
    type="button"
    @click="showDiagram = false"
  >
    Unmount diagram
  </button>
  <div
    v-if="showDiagram"
    id="diagram-root"
  >
    <Mermaid :code="encoded" />
  </div>
</template>
