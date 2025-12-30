<script setup lang="ts">
import type { MermaidCollectionItem } from '@nuxt/content'

// -- Types --
type MermaidPage = Pick<MermaidCollectionItem, 'title' | 'path' | 'type' | 'variant' | 'expect' | 'tags' | 'config' | 'notes' | 'body'>

// -- Route & Path --
const route = useRoute()
const slugParam = route.params.slug
const slugPath = Array.isArray(slugParam) ? slugParam.join('/') : slugParam
const targetPath = `/mermaid/${slugPath ?? ''}`

// -- Data Fetching --
const { data: page } = await useAsyncData<MermaidPage | null>(
  `mermaid-${targetPath}`,
  async () => queryCollection('mermaid')
    .path(targetPath)
    .select('title', 'path', 'type', 'variant', 'expect', 'tags', 'config', 'notes', 'body')
    .first(),
)

// -- Error Handling --
if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Mermaid case not found',
    fatal: true,
  })
}

// -- Computed --
const configText = computed(() => page.value?.config ? JSON.stringify(page.value.config, null, 2) : '')
const noteList = computed(() => page.value?.notes?.filter(Boolean) ?? [])
</script>

<template>
  <div class="page-container mermaid-page mermaid-page--detail">
    <!-- Navigation -->
    <nav class="nav-bar">
      <NuxtLink
        :to="{ path: '/mermaid', query: route.query.type ? { type: route.query.type } : undefined }"
        class="btn btn--secondary"
      >
        <span class="icon">←</span> Back to Catalog
      </NuxtLink>
      <NuxtLink
        to="/"
        class="btn btn--text"
      >
        Home
      </NuxtLink>
    </nav>

    <!-- Hero Section -->
    <header class="hero">
      <div class="hero__content">
        <p class="hero__eyebrow">
          {{ page?.type || 'Mermaid Case' }}
          <span
            v-if="page?.variant"
            class="hero__variant"
          >· {{ page.variant }}</span>
        </p>
        <h1 class="hero__title">
          {{ page?.title || page?.path }}
        </h1>

        <div
          v-if="page?.tags?.length"
          class="hero__tags"
        >
          <span
            v-for="tag in page.tags"
            :key="tag"
            class="tag"
          >
            #{{ tag }}
          </span>
        </div>
      </div>
    </header>

    <!-- Meta Details -->
    <section class="meta-panel">
      <div class="meta-item">
        <h3 class="meta-label">
          Expected Behavior
        </h3>
        <p class="meta-text">
          {{ page?.expect || 'No expected behavior documented.' }}
        </p>
        <ul
          v-if="noteList.length"
          class="meta-notes"
        >
          <li
            v-for="note in noteList"
            :key="note"
          >
            {{ note }}
          </li>
        </ul>
      </div>

      <div class="meta-item">
        <h3 class="meta-label">
          Configuration
        </h3>
        <div class="config-block">
          <pre v-if="configText"><code>{{ configText }}</code></pre>
          <p
            v-else
            class="meta-text text-muted"
          >
            Uses module defaults.
          </p>
        </div>
      </div>
    </section>

    <!-- Content Renderer -->
    <section class="content-area">
      <ContentRenderer
        v-if="page"
        :value="page"
      />
    </section>
  </div>
</template>
