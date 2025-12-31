<script setup lang="ts">
import { computed } from 'vue'

const code = 'graph TD;A-->B;B-->C;'
const encoded = computed(() => encodeURIComponent(code))
</script>

<template>
  <div id="diagram-root">
    <Mermaid :code="encoded" />
  </div>
</template>
