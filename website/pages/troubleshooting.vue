<script setup lang="ts">
const { data: page } = await useAsyncData('website-troubleshooting', () => (
  queryCollection('pages').path('/troubleshooting').first()
))

if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Troubleshooting content not found' })

useSeoMeta({
  title: `${page.value.title} | Nuxt Content Mermaid`,
  description: page.value.description,
})
useHead({
  link: [{ rel: 'canonical', href: '/troubleshooting' }],
  meta: [{ name: 'robots', content: 'index, follow' }],
})
</script>

<template>
  <PageShell :page="page!" />
</template>
