<script setup lang="ts">
import LandingMermaidDemo from '~/components/LandingMermaidDemo.vue'

const { locale } = useI18n()
const localePath = useLocalePath()
const landingKey = computed(() => `landing-page:${locale.value}`)

const { data: page } = await useAsyncData(landingKey, () => {
  return queryCollection('docs').path(localePath('/')).first()
})

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Landing page not found',
  })
}

useSeoMeta({
  title: page.value.title,
  description: page.value.description,
  ogTitle: page.value.title,
  ogDescription: page.value.description,
})

const landingContentComponents = {
  ContentMermaidTransport: LandingMermaidDemo,
}
</script>

<template>
  <main
    v-if="page"
    id="main-content"
    class="landing"
    tabindex="-1"
  >
    <section class="landing-hero">
      <div class="landing-hero__copy">
        <p class="landing-eyebrow">{{ $t('landing.eyebrow') }}</p>
        <h1>{{ page.title }}</h1>
        <p class="landing-description">
          {{ page.description }}
        </p>
        <NuxtLink
          class="primary-cta"
          :to="localePath('/getting-started')"
        >
          {{ $t('landing.getStarted') }}
          <span aria-hidden="true">→</span>
        </NuxtLink>
      </div>

      <ContentRenderer
        class="landing-demo-content"
        :value="page"
        :data="{ config: null }"
        :components="landingContentComponents"
      />
    </section>

  </main>
</template>
