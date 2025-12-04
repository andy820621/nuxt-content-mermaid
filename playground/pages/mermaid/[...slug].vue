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
  <div class="page-container">
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

<style scoped>
/* -- Variables & Reset -- */
.page-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #1e293b;
}

/* -- Navigation -- */
.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

/* -- Hero -- */
.hero {
  margin-bottom: 40px;
}

.hero__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.75rem;
  font-weight: 700;
  color: #0ea5e9;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.hero__variant {
  color: #94a3b8;
  font-weight: 500;
}

.hero__title {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 20px 0;
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* -- Meta Panel -- */
.meta-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  padding: 24px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  margin-bottom: 40px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-item--full {
  grid-column: 1 / -1;
}

.meta-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: #64748b;
  margin: 0;
}

.meta-text {
  font-size: 0.95rem;
  line-height: 1.5;
  color: #334155;
  margin: 0;
}

.text-muted {
  color: #94a3b8;
  font-style: italic;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85rem;
  background: #fff;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  display: inline-block;
}

.meta-notes {
  margin: 0;
  padding-left: 20px;
  color: #334155;
  font-size: 0.95rem;
}

.config-block {
  background: #0f172a;
  border-radius: 8px;
  overflow: hidden;
}

.config-block pre {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
  color: #e2e8f0;
  font-size: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* -- Content Area -- */
.content-area {
  padding: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

/* -- Components -- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.btn--secondary {
  background-color: #fff;
  border: 1px solid #e2e8f0;
  color: #475569;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.btn--secondary:hover {
  background-color: #f8fafc;
  border-color: #cbd5e1;
  color: #0f172a;
  transform: translateY(-1px);
}

.btn--text {
  background: none;
  border: none;
  color: #64748b;
  padding: 0 8px;
}

.btn--text:hover {
  color: #0ea5e9;
}

.tag {
  font-size: 0.75rem;
  padding: 4px 10px;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 999px;
  font-weight: 600;
}
</style>
