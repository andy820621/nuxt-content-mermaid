<script setup lang="ts">
import { computed, ref } from 'vue'

const diagramVersion = ref(0)
const code = computed(() => `graph TD;PRIMARY_${diagramVersion.value}-->B;B-->C;`)
const secondaryCode = 'graph TD;SECONDARY-->B;'
const encoded = computed(() => encodeURIComponent(code.value))
const encodedSecondary = computed(() => encodeURIComponent(secondaryCode))
const showDiagram = ref(true)
</script>

<template>
  <button
    id="update-diagram"
    type="button"
    @click="diagramVersion++"
  >
    Update diagram
  </button>
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
  <div id="secondary-root">
    <Mermaid :code="encodedSecondary" />
  </div>
</template>
