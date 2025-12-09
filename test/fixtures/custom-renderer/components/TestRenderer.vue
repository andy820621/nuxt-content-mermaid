<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Component } from 'vue'

defineProps<{
  code?: string
  spinner?: Component
}>()

const isLoading = ref(true)

onMounted(() => {
  setTimeout(() => {
    isLoading.value = false
  }, 300)
})
</script>

<template>
  <div>
    <component
      :is="spinner"
      v-if="isLoading"
      data-testid="renderer-spinner"
    />
    <div
      v-else
      id="test-renderer"
      data-testid="renderer-output"
    >
      Rendered: {{ code }}
    </div>
  </div>
</template>
