<script setup lang="ts">
const { currentTheme, setMermaidTheme } = useMermaidTheme()

const activeTheme = computed<'light' | 'dark'>(() =>
  currentTheme.value === 'dark' ? 'dark' : 'light',
)

const nextTheme = computed(() => activeTheme.value === 'dark' ? 'light' : 'dark')

useHead(() => ({
  htmlAttrs: {
    'data-theme': activeTheme.value,
  },
}))

function toggleTheme() {
  setMermaidTheme(nextTheme.value)
}
</script>

<template>
  <div class="site-shell">
    <a
      class="skip-link"
      href="#main-content"
    >Skip to content</a>

    <header class="site-header">
      <div class="site-header__inner">
        <NuxtLink
          class="site-brand"
          to="/"
        >Nuxt Content Mermaid</NuxtLink>

        <nav
          class="site-nav"
          aria-label="Primary navigation"
        >
          <NuxtLink to="/getting-started">
            Documentation
          </NuxtLink>
          <NuxtLink to="/troubleshooting">
            Troubleshooting
          </NuxtLink>
        </nav>

        <div class="site-actions">
          <button
            class="icon-button"
            type="button"
            :aria-label="`Switch to ${nextTheme} mode`"
            :title="`Switch to ${nextTheme} mode`"
            @click="toggleTheme"
          >
            <svg
              v-if="activeTheme === 'dark'"
              aria-hidden="true"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
            </svg>
            <svg
              v-else
              aria-hidden="true"
              viewBox="0 0 24 24"
            >
              <path d="M20.35 15.35A9 9 0 0 1 8.65 3.65a9 9 0 1 0 11.7 11.7Z" />
            </svg>
          </button>

          <a
            class="icon-button"
            href="https://github.com/andy820621/nuxt-content-mermaid"
            aria-label="Nuxt Content Mermaid on GitHub"
            title="GitHub repository"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
            >
              <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
            </svg>
          </a>
        </div>
      </div>
    </header>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
