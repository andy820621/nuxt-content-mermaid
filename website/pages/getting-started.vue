<script setup lang="ts">
const { data: page } = await useAsyncData('website-getting-started', () => (
  queryCollection('pages').path('/getting-started').first()
))

if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Getting Started content not found' })

useSeoMeta({
  title: `${page.value.title} | Nuxt Content Mermaid`,
  description: page.value.description,
})
</script>

<template>
  <PageShell :page="page!" />
</template>
