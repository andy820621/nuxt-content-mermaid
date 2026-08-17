<script setup lang="ts">
import type { TocLink } from '@nuxt/content'
import type { CSSProperties } from 'vue'

const props = defineProps<{
  links: TocLink[]
}>()

const route = useRoute()
const { t } = useI18n()
const { flatLinks, isActive } = useDocsToc(
  () => props.links,
  () => route.path,
)
const baseDepth = computed(() => Math.min(...flatLinks.value.map(link => link.depth), 2))

function linkStyle(link: TocLink): CSSProperties {
  const depth = Math.max(0, link.depth - baseDepth.value)
  return { '--docs-toc-indent': `${0.75 + depth * 0.75}rem` }
}
</script>

<template>
  <nav :aria-label="t('docs.onThisPage')">
    <p>{{ t('docs.onThisPage') }}</p>
    <ul class="docs-toc-list">
      <li
        v-for="link in flatLinks"
        :key="link.id"
        class="docs-toc-item"
      >
        <a
          :href="`#${link.id}`"
          class="docs-toc-link"
          :class="{ 'docs-toc-link--active': isActive(link.id) }"
          :style="linkStyle(link)"
          :aria-current="isActive(link.id) ? 'location' : undefined"
        >
          {{ link.text }}
        </a>
      </li>
    </ul>
  </nav>
</template>
