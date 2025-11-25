<script setup lang="ts">
import { useNuxtApp } from '#app'
import { ref, onMounted, nextTick } from 'vue'

const { $mermaid } = useNuxtApp()
const mermaidContainer = ref<HTMLDivElement | null>(null)

async function renderMermaid() {
  if (!mermaidContainer.value) return

  // 從 slot 內容中抓出 ``` 區塊轉換後的 <pre><code> 文字
  const codeEl
    = mermaidContainer.value.querySelector('code')
      ?? mermaidContainer.value.querySelector('pre')

  const definition = codeEl?.textContent?.trim()
  if (!definition) return

  const mermaid = await $mermaid()

  mermaidContainer.value.removeAttribute('data-processed')
  mermaidContainer.value.textContent = definition

  await nextTick()
  await mermaid.run({
    nodes: [mermaidContainer.value],
    suppressErrors: true,
  })
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
  </div>
</template>

<style scoped>
.my-mermaid {
  display: flex;
  justify-content: center;
  border: 1px solid #ccc;
}

.my-mermaid:not([data-processed]) {
  color: transparent;
  min-height: 10px;
}
</style>
