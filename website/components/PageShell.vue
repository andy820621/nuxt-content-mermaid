<script setup lang="ts">
import type { PageCollections } from '@nuxt/content'

const props = defineProps<{
  page: PageCollections['pages']
}>()

const hydrated = ref(false)
const { currentTheme, setMermaidTheme } = useMermaidTheme()
const isDark = computed(() => currentTheme.value === 'dark')
const nextTheme = computed(() => isDark.value ? 'light' : 'dark')

function toggleTheme() {
  setMermaidTheme(nextTheme.value)
}

onMounted(() => {
  hydrated.value = true
})
</script>

<template>
  <div
    class="site-shell"
    :data-site-theme="isDark ? 'dark' : 'light'"
  >
    <a
      class="skip-link"
      href="#main-content"
    >Skip to content</a>
    <header class="site-header">
      <nav
        class="site-nav"
        aria-label="Primary navigation"
      >
        <NuxtLink
          data-brand-link
          class="brand-link"
          to="/"
          :aria-current="props.page.pageId === 'home' ? 'page' : undefined"
        >
          <span
            class="brand-mark"
            aria-hidden="true"
          >M</span>
          <span>Nuxt Content Mermaid</span>
        </NuxtLink>
        <div class="nav-actions">
          <NuxtLink
            to="/getting-started"
            class="nav-link"
            :aria-current="props.page.pageId === 'getting-started' ? 'page' : undefined"
          >
            Get started
          </NuxtLink>
          <button
            class="theme-toggle"
            type="button"
            :aria-label="`Switch to ${nextTheme} theme`"
            :aria-pressed="isDark"
            @click="toggleTheme"
          >
            <span aria-hidden="true">{{ isDark ? '☀' : '☾' }}</span>
          </button>
        </div>
      </nav>
    </header>
    <main
      id="main-content"
      :data-page-id="page.pageId"
      :data-hydration-state="hydrated ? 'hydrated' : 'prerendered'"
      tabindex="-1"
    >
      <slot name="content">
        <article class="document-page">
          <header class="document-hero">
            <p class="eyebrow">
              First Successful Render
            </p>
            <h1>{{ page.title }}</h1>
            <p class="document-description">
              {{ page.description }}
            </p>
          </header>
          <div class="prose">
            <ContentRenderer :value="page" />
          </div>
        </article>
      </slot>
      <slot />
    </main>
    <footer class="site-footer">
      <p>Built for package users. Experiments stay in the playground.</p>
    </footer>
  </div>
</template>
