<script setup lang="ts">
const { data: page } = await useAsyncData('website-migration-v3', () => (
  queryCollection('pages').path('/migration/v3').first()
))

if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Version 3 migration content not found' })

useSeoMeta({
  title: `${page.value.title} | Nuxt Content Mermaid`,
  description: page.value.description,
})
useHead({
  link: [{ rel: 'canonical', href: '/migration/v3' }],
  meta: [{ name: 'robots', content: 'index, follow' }],
})
</script>

<template>
  <PageShell :page="page!" />
</template>
