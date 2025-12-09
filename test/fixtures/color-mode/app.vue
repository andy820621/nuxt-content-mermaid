<script setup lang="ts">
import { computed } from 'vue'
import { useColorMode } from '#imports'

const colorMode = useColorMode()
const diagram = 'graph TD;A-->B;'
const encoded = computed(() => encodeURIComponent(diagram))

const setDark = () => {
  colorMode.preference = 'dark'
}
</script>

<template>
  <div>
    <button
      id="toggle-dark"
      type="button"
      @click="setDark"
    >
      to dark
    </button>
    <Mermaid :code="encoded" />
  </div>
</template>
