<script setup lang="ts">
const source = encodeURIComponent('graph TD; A-->B')

async function loadControlChunk() {
  await import('./control-prefetch')
}
</script>

<template>
  <main>
    <Mermaid :code="source" />
    <button
      type="button"
      @click="loadControlChunk"
    >
      Load control chunk
    </button>
  </main>
</template>
