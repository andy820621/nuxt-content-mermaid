<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import type { PageMermaidConfig } from '../../types/config'
import type { MermaidToolbarOptions } from '../../types/mermaid'

const props = defineProps<{
  pageConfig?: PageMermaidConfig | null
  toolbar?: MermaidToolbarOptions
  code?: string
}>()

// Nuxt Content serializes an absent optional frontmatter field as null. Keep that
// sentinel normalization inside this Markdown-only transport component.
const normalizedPageConfig = computed(() =>
  props.pageConfig === null ? undefined : props.pageConfig,
)
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
