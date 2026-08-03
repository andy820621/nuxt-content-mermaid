<script setup lang="ts">
import { onErrorCaptured, ref, resolveComponent, shallowRef } from 'vue'
import type { MermaidConfig } from 'mermaid'
import type { PageMermaidConfig } from '../../../src/types/config'

const MermaidComponent = resolveComponent('Mermaid')
const code = ref('graph TD;INITIAL-->DONE')
const pageConfig = shallowRef<PageMermaidConfig | undefined>({ theme: 'forest' })
const directConfig = shallowRef<MermaidConfig | undefined>()
const componentErrorCount = ref(0)

onErrorCaptured(() => {
  componentErrorCount.value++
  return false
})

function enterConflict() {
  directConfig.value = { theme: 'dark' }
}

function recoverConflict() {
  pageConfig.value = undefined
  directConfig.value = { theme: 'dark' }
  code.value = 'graph TD;RECOVERED_LATEST-->DONE'
}
</script>

<template>
  <main>
    <button
      id="enter-conflict"
      type="button"
      @click="enterConflict"
    >
      Enter conflict
    </button>
    <button
      id="recover-conflict"
      type="button"
      @click="recoverConflict"
    >
      Recover conflict
    </button>
    <output id="component-error">{{ componentErrorCount }}</output>
    <component
      :is="MermaidComponent"
      :code="encodeURIComponent(code)"
      :page-config="pageConfig"
      :config="directConfig"
    />
  </main>
</template>
