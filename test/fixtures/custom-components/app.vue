<script setup lang="ts">
import { ref, computed } from 'vue'

type GlobalWithFlag = Window & { __forceMermaidError?: boolean }

const mode = ref<'working' | 'broken'>('working')

const workingDiagram = 'graph TD;A-->B;B-->C;'
const brokenDiagram = 'graph TD;__FORCE_ERROR__'

const currentDiagram = computed(() => {
  return mode.value === 'working' ? workingDiagram : brokenDiagram
})

const encoded = computed(() => encodeURIComponent(currentDiagram.value))

const setForceError = (value: boolean) => {
  if (typeof window === 'undefined') return
  (window as GlobalWithFlag).__forceMermaidError = value
}

const toggleMode = () => {
  mode.value = mode.value === 'working' ? 'broken' : 'working'
  setForceError(mode.value === 'broken')
}

setForceError(false)
</script>

<template>
  <div>
    <button
      id="toggle-diagram"
      type="button"
      @click="toggleMode"
    >
      Toggle: {{ mode === 'working' ? 'Show Broken' : 'Show Working' }}
    </button>

    <div id="diagram-container">
      <Mermaid :code="encoded" />
    </div>
  </div>
</template>
