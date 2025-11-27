<script setup lang="ts">
import { useNuxtApp } from '#app'
import { ref, onMounted, nextTick, useTemplateRef } from 'vue'
import type { Component } from 'vue'
import { enqueueRender } from '../utils/renderQueue'

defineProps<{
  spinner?: Component | string
}>()

const { $mermaid } = useNuxtApp()
const mermaidContainer = useTemplateRef('mermaidContainer')
const isLoading = ref(false)

async function renderMermaid() {
  if (!mermaidContainer.value) return
  isLoading.value = true

  const performRender = async () => {
    if (!mermaidContainer.value) return

    try {
      // Extract the text from the <pre><code> element that was generated from a ``` fenced code block in the slot
      const codeEl
        = mermaidContainer.value.querySelector('code')
          ?? mermaidContainer.value.querySelector('pre')

      const definition = codeEl?.textContent?.trim()
      if (!definition) {
        return
      }

      const mermaid = await $mermaid()

      mermaidContainer.value.removeAttribute('data-processed')
      mermaidContainer.value.textContent = definition

      await nextTick()
      await mermaid.run({
        nodes: [mermaidContainer.value],
        suppressErrors: true,
      })

      // Add delay
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    catch (e) {
      console.error(e)
    }
    finally {
      isLoading.value = false
    }
  }

  await enqueueRender(performRender)
}

onMounted(() => {
  renderMermaid()
})
</script>

<template>
  <h3>This is Custom Mermaid Component</h3>

  <div
    ref="mermaidContainer"
    class="my-mermaid"
  >
    <slot />
    <div
      v-if="isLoading && spinner"
      class="spinner-container"
    >
      <component
        :is="spinner"
      />
    </div>
  </div>
</template>

<style scoped>
.my-mermaid {
  display: flex;
  justify-content: center;
  border: 1px solid #ccc;
  width: 100%;
  position: relative;
}
.spinner-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.my-mermaid:not([data-processed]) {
  color: transparent;
  min-height: 10px;
}
</style>
