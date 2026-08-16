<script setup lang="ts">
import type { SupportedLocale } from '~/utils/filterLocaleNavigation'
import { filterLocaleNavigation } from '~/utils/filterLocaleNavigation'

definePageMeta({
  layout: false,
  key: route => route.path,
})

const route = useRoute()
const { locale } = useI18n()

const { data: page } = await useAsyncData(`docs-page:${route.path}`, () => {
  return queryCollection('docs').path(route.path).first()
})

const { data: navigation } = await useAsyncData(
  () => `docs-navigation:${locale.value}`,
  async () => filterLocaleNavigation(
    await queryCollectionNavigation('docs'),
    locale.value as SupportedLocale,
  ),
)

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
