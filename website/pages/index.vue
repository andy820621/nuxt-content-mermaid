<script setup lang="ts">
const { data: page } = await useAsyncData('website-home', () => (
  queryCollection('pages').path('/').first()
))

if (!page.value) throw createError({ statusCode: 404, statusMessage: 'Home content not found' })

useSeoMeta({
  title: page.value.title,
  description: page.value.description,
})
</script>

<template>
  <PageShell :page="page!">
    <ContractDemo />
  </PageShell>
</template>
