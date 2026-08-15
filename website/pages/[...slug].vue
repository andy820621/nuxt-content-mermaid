<script setup lang="ts">
definePageMeta({
  layout: false,
  key: route => route.path,
})

const route = useRoute()

const { data: page } = await useAsyncData(`docs-page:${route.path}`, () => {
  return queryCollection('docs').path(route.path).first()
})

const { data: navigation } = await useAsyncData('docs-navigation', () => {
  return queryCollectionNavigation('docs')
})

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Documentation page not found',
  })
}

useSeoMeta({
  title: page.value.title,
  description: page.value.description,
  ogTitle: page.value.title,
  ogDescription: page.value.description,
})
</script>

<template>
  <NuxtLayout
    v-if="page"
    name="docs"
    :page="page"
    :navigation="navigation ?? []"
  >
    <ContentRenderer :value="page" />
  </NuxtLayout>
</template>
