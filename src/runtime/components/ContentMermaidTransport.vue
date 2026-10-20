<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import type { PageMermaidConfig } from '../../types/config'
import type { MermaidToolbarOptions } from '../../types/mermaid'

const props = defineProps<{
  pageData?: { config?: PageMermaidConfig | null }
  toolbar?: MermaidToolbarOptions
  code?: string
}>()

// Bind the whole MDC data object: unresolved field bindings become literal strings.
// Nuxt Content serializes an absent optional frontmatter field as null.
const normalizedPageConfig = computed(() => {
  const config = props.pageData?.config
  return config === null ? undefined : config
})
const MermaidComponent = resolveComponent('Mermaid')
</script>

<template>
  <component
    :is="MermaidComponent"
    :page-config="normalizedPageConfig"
    :toolbar="props.toolbar"
    :code="props.code"
  />
</template>
