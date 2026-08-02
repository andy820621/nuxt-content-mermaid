<script setup lang="ts">
import { useRuntimeConfig } from '#app'

const contentMermaid = useRuntimeConfig().public.contentMermaid
</script>

<template>
  <div :data-content-mermaid-present="String(contentMermaid !== undefined)" />
</template>
