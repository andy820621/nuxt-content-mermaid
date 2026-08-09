<script setup lang="ts">
import { useAsyncData, useRuntimeConfig } from '#app'

type ContentPage = {
  title?: string
}

declare const queryCollection: (collection: 'content') => {
  path: (path: string) => {
    first: () => Promise<ContentPage | null>
  }
}

const contentMermaid = useRuntimeConfig().public.contentMermaid
const { data: page } = await useAsyncData('disabled-content-page', () => {
  return queryCollection('content').path('/').first()
})
</script>

<template>
  <div
    :data-content-mermaid-present="String(contentMermaid !== undefined)"
    :data-content-loaded="String(page?.title === 'Content remains active')"
  />
</template>
