<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import type { SupportedLocale } from '~/types/i18n'
import { filterLocaleNavigation } from '~/utils/filterLocaleNavigation'
import { SITE_ORIGIN, toSiteURL } from '~/utils/site'

const { locale, localeProperties } = useI18n()
const localePath = useLocalePath()

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

const localizedNavigation = computed(() => filterLocaleNavigation(
  navigation.value ?? [],
  locale.value as SupportedLocale,
))

const mobileNavigationItems = computed(() => flattenPages(localizedNavigation.value))

const socialImageUrl = `${SITE_ORIGIN}/assets/nuxt-content-mermaid.png`
const route = useRoute()

useHead(() => ({
  htmlAttrs: {
    lang: localeProperties.value.language,
  },
  bodyAttrs: {
    class: mobileMenuOpen.value ? 'mobile-menu-open' : undefined,
  },
  link: [
    { rel: 'canonical', href: toSiteURL(route.path) },
    { rel: 'icon', href: '/assets/favicon/favicon.ico', sizes: 'any' },
    { rel: 'icon', type: 'image/png', href: '/assets/favicon/favicon-32x32.png', sizes: '32x32' },
    { rel: 'icon', type: 'image/png', href: '/assets/favicon/favicon-16x16.png', sizes: '16x16' },
    { rel: 'apple-touch-icon', href: '/assets/favicon/apple-touch-icon.png', sizes: '180x180' },
  ],
}))

useSeoMeta({
  ogSiteName: 'Nuxt Content Mermaid',
  ogType: 'website',
  ogUrl: () => toSiteURL(route.path),
  ogImage: socialImageUrl,
  ogImageAlt: 'Nuxt Content Mermaid',
  twitterCard: 'summary_large_image',
  twitterImage: socialImageUrl,
  twitterImageAlt: 'Nuxt Content Mermaid',
})

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
          :to="localePath('/')"
          :aria-label="$t('site.name')"
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
          <NuxtLink :to="localePath('/getting-started')">
            {{ $t('navigation.documentation') }}
          </NuxtLink>
          <NuxtLink :to="localePath('/troubleshooting')">
            {{ $t('navigation.troubleshooting') }}
          </NuxtLink>
        </nav>

        <div class="site-actions">
          <ThemeToggle />

          <a
            class="icon-button"
            href="https://github.com/andy820621/nuxt-content-mermaid"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="$t('site.github')"
            :title="$t('site.githubTitle')"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
            >
              <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
            </svg>
          </a>

          <LocaleSwitcher />

          <button
            id="mobile-menu-button"
            ref="mobileMenuButton"
            class="icon-button mobile-menu-toggle"
            type="button"
            :aria-label="mobileMenuOpen ? $t('actions.closeMenu') : $t('actions.openMenu')"
            :title="mobileMenuOpen ? $t('actions.closeMenu') : $t('actions.openMenu')"
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
        :aria-label="$t('navigation.documentation')"
      >
        <p>{{ $t('navigation.documentation') }}</p>
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

      <footer class="site-footer">
        <p class="site-footer__inner">
          © 2025–present
          <a
            href="https://github.com/andy820621"
            target="_blank"
            rel="noopener noreferrer"
          >BarZ Hsieh</a>
          ·
          <a
            href="https://github.com/andy820621/nuxt-content-mermaid/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >MIT License</a>
        </p>
      </footer>
    </div>
  </div>
</template>
