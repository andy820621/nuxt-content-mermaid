<script setup lang="ts">
import LandingMermaidDemo from '~/components/LandingMermaidDemo.vue'

const { data: page } = await useAsyncData('landing-page', () => {
  return queryCollection('docs').path('/').first()
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
        <p class="landing-eyebrow">
          Nuxt Content × Mermaid
        </p>
        <h1>{{ page.title }}</h1>
        <p class="landing-description">
          {{ page.description }}
        </p>
        <NuxtLink
          class="primary-cta"
          to="/getting-started"
        >
          Get started
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

    <section
      class="feature-grid"
      aria-label="Features"
    >
      <article class="feature-card">
        <span class="feature-card__number">01</span>
        <h2>Write diagrams in Markdown</h2>
        <p>Use familiar <code>mermaid</code> fences in Nuxt Content.</p>
      </article>
      <article class="feature-card">
        <span class="feature-card__number">02</span>
        <h2>Render interactive diagrams</h2>
        <p>Get theme-aware diagrams with built-in controls.</p>
      </article>
      <article class="feature-card">
        <span class="feature-card__number">03</span>
        <h2>Keep the source readable</h2>
        <p>Preserve readable Markdown when JavaScript is unavailable.</p>
      </article>
    </section>
  </main>
</template>
