<script setup lang="ts">
import type { MermaidCollectionItem } from '@nuxt/content'

// -- Types --
type MermaidDoc = Pick<MermaidCollectionItem, 'title' | 'path' | 'type' | 'variant' | 'expect' | 'tags' | 'config'>

// -- State --
const route = useRoute()
const router = useRouter()

const typeFilter = computed({
  get: () => (route.query.type as string) || 'all',
  set: (val) => {
    router.push({ query: { ...route.query, type: val === 'all' ? undefined : val } })
  },
})

// -- Data Fetching --
const { data: items } = await useAsyncData<MermaidDoc[]>('mermaid-cases', async () =>
  queryCollection('mermaid')
    .select('title', 'path', 'type', 'variant', 'expect', 'tags', 'config')
    .all(),
)

// -- Computed --
const typeOptions = computed(() => {
  const set = new Set<string>()
  const list = items.value ?? []

  for (const item of list) {
    if (item.type) set.add(item.type)
  }
  return ['all', ...Array.from(set).sort()]
})

const filtered = computed(() => {
  const list = items.value ?? []

  return list
    .filter(item => typeFilter.value === 'all' || item.type === typeFilter.value)
    .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
})

// -- Helpers --
function formatConfig(config?: Record<string, unknown>) {
  if (!config || Object.keys(config).length === 0) return 'Default configuration'
  return Object.entries(config)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(', ')
}
</script>

<template>
  <div class="page-container mermaid-page mermaid-page--catalog">
    <!-- Hero Section -->
    <header class="hero">
      <div class="hero__content">
        <p class="hero__eyebrow">
          Playground
        </p>
        <h1 class="hero__title">
          Mermaid Chart Catalog
        </h1>
        <p class="hero__description">
          Explore various Mermaid diagram examples. Filter by type, view configurations, and click to experiment.
        </p>
      </div>
      <div class="hero__actions">
        <NuxtLink
          to="/"
          class="btn btn--secondary"
        >
          <span class="icon">←</span> Back to Home
        </NuxtLink>
      </div>
    </header>

    <!-- Filters -->
    <nav
      class="filters"
      aria-label="Filter by chart type"
    >
      <button
        v-for="option in typeOptions"
        :key="option"
        type="button"
        class="filter-chip"
        :class="{ 'filter-chip--active': typeFilter === option }"
        @click="typeFilter = option"
      >
        {{ option === 'all' ? 'All Types' : option }}
      </button>
    </nav>

    <!-- Grid -->
    <main
      v-if="filtered.length"
      class="grid"
    >
      <NuxtLink
        v-for="item in filtered"
        :key="item.path"
        :to="{ path: item.path, query: typeFilter !== 'all' ? { type: typeFilter } : undefined }"
        class="card"
      >
        <div class="card__header">
          <span class="card__type">{{ item.type || 'Unspecified' }}</span>
          <span
            v-if="item.variant"
            class="card__variant"
          >· {{ item.variant }}</span>
        </div>

        <h2 class="card__title">
          {{ item.title || 'Untitled Case' }}
        </h2>

        <p class="card__expect">
          {{ item.expect || 'No expected outcome documented.' }}
        </p>

        <div class="card__footer">
          <div class="card__config">
            <span class="label">Config:</span> {{ formatConfig(item.config) }}
          </div>

          <div
            v-if="item.tags?.length"
            class="card__tags"
          >
            <span
              v-for="tag in item.tags"
              :key="tag"
              class="tag"
            >
              #{{ tag }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </main>

    <!-- Empty State -->
    <div
      v-else
      class="empty-state"
    >
      <div class="empty-state__content">
        <p>No cases found for this filter.</p>
        <button
          class="btn btn--text"
          @click="typeFilter = 'all'"
        >
          Clear filters
        </button>
      </div>
    </div>
  </div>
</template>
