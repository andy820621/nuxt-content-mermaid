<script setup lang="ts">
import type { ContentNavigationItem, PageCollections } from '@nuxt/content'

const props = defineProps<{
  page: PageCollections['docs']
  navigation: ContentNavigationItem[]
}>()

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
        <nav aria-label="Documentation">
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
        <nav aria-label="On this page">
          <p>On this page</p>
          <ul>
            <li
              v-for="link in tocLinks"
              :key="link.id"
            >
              <a :href="`#${link.id}`">{{ link.text }}</a>
              <ul v-if="link.children?.length">
                <li
                  v-for="child in link.children"
                  :key="child.id"
                >
                  <a :href="`#${child.id}`">{{ child.text }}</a>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
      </aside>
    </div>
  </div>
</template>
