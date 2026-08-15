<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

const { currentTheme, setMermaidTheme } = useMermaidTheme()

const mobileMenuButton = useTemplateRef<HTMLButtonElement>('mobileMenuButton')
const mobileMenuOpen = ref(false)

const { data: navigation } = await useAsyncData('mobile-docs-navigation', () => {
  return queryCollectionNavigation('docs')
})

function flattenPages(items: ContentNavigationItem[]): ContentNavigationItem[] {
  return items.flatMap(item => [
    ...(item.page === false ? [] : [item]),
    ...flattenPages(item.children ?? []),
  ])
}

const mobileNavigationItems = computed(() => flattenPages(navigation.value ?? []))

const activeTheme = computed<'light' | 'dark'>(() =>
  currentTheme.value === 'dark' ? 'dark' : 'light',
)

const siteOrigin = 'https://nuxt-content-mermaid.barz.app'
const socialImageUrl = `${siteOrigin}/assets/nuxt-content-mermaid.png`
const route = useRoute()

const nextTheme = computed(() => activeTheme.value === 'dark' ? 'light' : 'dark')

useHead(() => ({
  htmlAttrs: {
    lang: 'en',
    'data-theme': activeTheme.value,
  },
  bodyAttrs: {
    class: mobileMenuOpen.value ? 'mobile-menu-open' : undefined,
  },
  link: [
    { rel: 'icon', href: '/assets/favicon/favicon.ico', sizes: 'any' },
    { rel: 'icon', type: 'image/png', href: '/assets/favicon/favicon-32x32.png', sizes: '32x32' },
    { rel: 'icon', type: 'image/png', href: '/assets/favicon/favicon-16x16.png', sizes: '16x16' },
    { rel: 'apple-touch-icon', href: '/assets/favicon/apple-touch-icon.png', sizes: '180x180' },
  ],
}))

useSeoMeta({
  ogSiteName: 'Nuxt Content Mermaid',
  ogType: 'website',
  ogUrl: () => new URL(route.path, siteOrigin).href,
  ogImage: socialImageUrl,
  ogImageAlt: 'Nuxt Content Mermaid',
  twitterCard: 'summary_large_image',
  twitterImage: socialImageUrl,
  twitterImageAlt: 'Nuxt Content Mermaid',
})

function toggleTheme() {
  setMermaidTheme(nextTheme.value)
}

let mobileViewport: MediaQueryList | undefined

async function closeMobileMenu(restoreFocus = false) {
  if (!mobileMenuOpen.value)
    return

  mobileMenuOpen.value = false

  if (restoreFocus) {
    await nextTick()
    mobileMenuButton.value?.focus()
  }
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mobileMenuOpen.value)
    void closeMobileMenu(true)
}

function handleViewportChange(event: MediaQueryListEvent) {
  if (!event.matches)
    void closeMobileMenu()
}

watch(() => route.fullPath, () => {
  void closeMobileMenu()
})

onMounted(() => {
  mobileViewport = window.matchMedia('(max-width: 48rem)')
  mobileViewport.addEventListener('change', handleViewportChange)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  mobileViewport?.removeEventListener('change', handleViewportChange)
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="site-shell">
    <a
      class="skip-link"
      href="#main-content"
      :inert="mobileMenuOpen"
      :aria-hidden="mobileMenuOpen ? 'true' : undefined"
    >Skip to content</a>

    <header class="site-header">
      <div class="site-header__inner">
        <NuxtLink
          class="site-brand"
          to="/"
          aria-label="Nuxt Content Mermaid"
        >
          <img
            class="site-brand__icon"
            src="/assets/nuxt-content-mermaid-icon.svg"
            alt=""
            width="96"
            height="96"
          >
          <svg
            class="site-brand__wordmark"
            viewBox="0 0 743 50"
            width="743"
            height="50"
            role="img"
            aria-labelledby="site-brand-wordmark-title"
          >
            <title id="site-brand-wordmark-title">Nuxt Content Mermaid</title>
            <use href="/assets/nuxt-content-mermaid-wordmark.svg#nuxt" />
            <use href="/assets/nuxt-content-mermaid-wordmark.svg#content" />
            <use href="/assets/nuxt-content-mermaid-wordmark.svg#mermaid" />
          </svg>
        </NuxtLink>

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

          <button
            id="mobile-menu-button"
            ref="mobileMenuButton"
            class="icon-button mobile-menu-toggle"
            type="button"
            :aria-label="mobileMenuOpen ? 'Close menu' : 'Open menu'"
            :title="mobileMenuOpen ? 'Close menu' : 'Open menu'"
            :aria-expanded="mobileMenuOpen"
            aria-controls="mobile-documentation-menu"
            @click="toggleMobileMenu"
          >
            <svg
              v-if="mobileMenuOpen"
              aria-hidden="true"
              viewBox="0 0 24 24"
            >
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
            <svg
              v-else
              aria-hidden="true"
              viewBox="0 0 24 24"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div
      v-if="mobileMenuOpen"
      id="mobile-documentation-menu"
      class="mobile-documentation-menu"
    >
      <nav
        class="mobile-documentation-menu__inner"
        aria-label="Documentation"
      >
        <p>Documentation</p>
        <NuxtLink
          v-for="item in mobileNavigationItems"
          :key="item.path"
          class="mobile-navigation-link"
          :to="item.path"
          :aria-current="item.path === route.path ? 'page' : undefined"
          @click="closeMobileMenu()"
        >
          {{ item.title }}
        </NuxtLink>
      </nav>
    </div>

    <div
      class="site-page"
      :inert="mobileMenuOpen"
      :aria-hidden="mobileMenuOpen ? 'true' : undefined"
    >
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
  </div>
</template>
