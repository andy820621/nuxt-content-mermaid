<script setup lang="ts">
import type { PageCollections } from '@nuxt/content'

defineProps<{
  page: PageCollections['pages']
}>()

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
</script>

<template>
  <nav aria-label="Primary navigation">
    <NuxtLink
      v-if="page.pageId === 'home'"
      to="/getting-started"
    >
      Get started
    </NuxtLink>
    <NuxtLink
      v-else
      to="/"
    >
      Home
    </NuxtLink>
  </nav>
  <main
    :data-page-id="page.pageId"
    :data-hydration-state="hydrated ? 'hydrated' : 'prerendered'"
  >
    <h1>{{ page.title }}</h1>
    <ContentRenderer :value="page" />
    <slot />
  </main>
</template>
