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
  <div class="page-container">
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

<style scoped>
/* -- Variables & Reset -- */
.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #1e293b;
}

/* -- Hero -- */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.hero__content {
  max-width: 600px;
}

.hero__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.75rem;
  font-weight: 700;
  color: #0ea5e9;
  margin-bottom: 8px;
}

.hero__title {
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 16px 0;
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero__description {
  font-size: 1.125rem;
  line-height: 1.6;
  color: #64748b;
  margin: 0;
}

/* -- Buttons -- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
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
  color: #0ea5e9;
  padding: 0;
  font-size: 1rem;
}

.btn--text:hover {
  text-decoration: underline;
}

/* -- Filters -- */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #f1f5f9;
}

.filter-chip {
  padding: 8px 16px;
  border-radius: 9999px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-chip:hover {
  border-color: #bae6fd;
  color: #0284c7;
  background: #f0f9ff;
}

.filter-chip--active {
  background: #0ea5e9;
  border-color: #0ea5e9;
  color: #fff;
  box-shadow: 0 2px 4px rgba(14, 165, 233, 0.2);
}

.filter-chip--active:hover {
  background: #0284c7;
  border-color: #0284c7;
  color: #fff;
}

/* -- Grid -- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

/* -- Card -- */
.card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.08), 0 4px 8px -4px rgba(0, 0, 0, 0.04);
  border-color: #cbd5e1;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: #0ea5e9;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.card:hover::before {
  opacity: 1;
}

.card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #0ea5e9;
}

.card__variant {
  color: #94a3b8;
  font-weight: 500;
}

.card__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.card__expect {
  font-size: 0.95rem;
  color: #64748b;
  margin: 0 0 20px 0;
  line-height: 1.5;
  flex-grow: 1;
}

.card__footer {
  padding-top: 16px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card__config {
  font-size: 0.8rem;
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card__config .label {
  color: #64748b;
  font-weight: 600;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  font-size: 0.75rem;
  padding: 4px 10px;
  background: #f1f5f9;
  color: #475569;
  border-radius: 6px;
  font-weight: 500;
}

/* -- Empty State -- */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: #f8fafc;
  border-radius: 16px;
  border: 2px dashed #e2e8f0;
  color: #64748b;
}
</style>
