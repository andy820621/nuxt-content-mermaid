<script setup lang="ts">
import { computed } from 'vue'

const diagram = 'graph TD;A-->B;B-->C;'
const encoded = computed(() => encodeURIComponent(diagram))
</script>

<template>
  <div id="diagram-container">
    <Mermaid :code="encoded" />
  </div>
</template>
