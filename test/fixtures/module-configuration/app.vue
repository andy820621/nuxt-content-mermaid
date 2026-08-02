<script setup lang="ts">
import { useRuntimeConfig } from '#app'

const contentMermaid = useRuntimeConfig().public.contentMermaid ?? {}

const hasModuleActivation = Object.prototype.hasOwnProperty.call(contentMermaid, 'enabled')
const expand = contentMermaid.expand
const expandEnabled = expand === false
  ? false
  : typeof expand === 'object' && expand !== null
    ? expand.enabled
    : undefined
</script>

<template>
  <pre
    :data-has-module-activation="String(hasModuleActivation)"
    :data-expand-enabled="String(expandEnabled)"
  >{{ JSON.stringify(contentMermaid) }}</pre>
</template>
