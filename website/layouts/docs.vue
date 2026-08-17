<script setup lang="ts">
import type { ContentNavigationItem, PageCollections } from '@nuxt/content'

const props = defineProps<{
  page: PageCollections['docs']
  navigation: ContentNavigationItem[]
}>()

const { t } = useI18n()

function flattenPages(items: ContentNavigationItem[]): ContentNavigationItem[] {
  return items.flatMap(item => [
    ...(item.page === false ? [] : [item]),
    ...flattenPages(item.children ?? []),
  ])
}

const sidebarItems = computed(() => flattenPages(props.navigation))
const tocLinks = computed(() => props.page.body.toc?.links ?? [])
</script>

<template>
  <div class="docs-shell">
    <div class="docs-grid">
      <aside class="docs-sidebar">
        <nav :aria-label="t('docs.documentation')">
          <NuxtLink
            v-for="item in sidebarItems"
            :key="item.path"
            class="docs-navigation-link"
            :to="item.path"
            :aria-current="item.path === page.path ? 'page' : undefined"
          >
            {{ item.title }}
          </NuxtLink>
        </nav>
      </aside>

      <main
        id="main-content"
        class="docs-content"
        tabindex="-1"
      >
        <article>
          <slot />
        </article>
      </main>

      <aside
        v-if="tocLinks.length"
        class="docs-toc"
      >
        <DocsToc :links="tocLinks" />
      </aside>
    </div>
  </div>
</template>
