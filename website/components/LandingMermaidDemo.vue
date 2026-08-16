<script setup lang="ts">
import type {
  MermaidComponentProps,
  PageMermaidConfig,
} from '@barzhsieh/nuxt-content-mermaid'

type DemoTab = 'source' | 'preview'
type MermaidToolbar = NonNullable<MermaidComponentProps['toolbar']>

const props = defineProps<{
  pageConfig?: PageMermaidConfig | null
  toolbar?: MermaidToolbar
  code?: string
}>()

const tabs = [
  { id: 'source', labelKey: 'demo.markdown' },
  { id: 'preview', labelKey: 'demo.renderedUi' },
] as const

const activeTab = ref<DemoTab>('preview')
const tabButtons = useTemplateRef<HTMLButtonElement[]>('tabButtons')
const markdownSource = computed(() => {
  const code = props.code ? decodeURIComponent(props.code) : ''
  return `\`\`\`mermaid\n${code}\n\`\`\``
})
const ContentMermaidTransport = resolveComponent('ContentMermaidTransport')

function selectTab(tab: DemoTab) {
  activeTab.value = tab
}

async function handleTabKeydown(event: KeyboardEvent, index: number) {
  const lastIndex = tabs.length - 1
  const nextIndex = {
    ArrowLeft: index === 0 ? lastIndex : index - 1,
    ArrowRight: index === lastIndex ? 0 : index + 1,
    Home: 0,
    End: lastIndex,
  }[event.key]

  if (nextIndex === undefined)
    return

  event.preventDefault()
  const nextTab = tabs[nextIndex]
  if (!nextTab)
    return

  selectTab(nextTab.id)
  await nextTick()
  tabButtons.value?.[nextIndex]?.focus()
}
</script>

<template>
  <div class="landing-demo">
    <div class="landing-demo__surface">
      <div
        class="landing-demo__tabs"
        role="tablist"
        :aria-label="$t('demo.views')"
      >
        <button
          v-for="(tab, index) in tabs"
          :id="`landing-demo-${tab.id}-tab`"
          ref="tabButtons"
          :key="tab.id"
          class="landing-demo__tab"
          :class="{ 'landing-demo__tab--active': activeTab === tab.id }"
          type="button"
          role="tab"
          :aria-controls="`landing-demo-${tab.id}-panel`"
          :aria-selected="activeTab === tab.id"
          :tabindex="activeTab === tab.id ? 0 : -1"
          @click="selectTab(tab.id)"
          @keydown="handleTabKeydown($event, index)"
        >
          <svg
            v-if="tab.id === 'source'"
            class="landing-demo__tab-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M14 3v5h5M9 13l-2 2 2 2M15 13l2 2-2 2M13 12l-2 6" />
          </svg>
          <svg
            v-else
            class="landing-demo__tab-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <rect
              x="3"
              y="4"
              width="18"
              height="16"
              rx="2"
            />
            <path d="M3 9h18M7 6.5h.01M10 6.5h.01M8 14h3M13 12h3M13 16h3" />
          </svg>
          {{ $t(tab.labelKey) }}
        </button>
      </div>

      <div
        id="landing-demo-preview-panel"
        v-show="activeTab === 'preview'"
        class="landing-demo__panel landing-demo__panel--preview"
        role="tabpanel"
        aria-labelledby="landing-demo-preview-tab"
        tabindex="0"
      >
        <component
          :is="ContentMermaidTransport"
          :page-config="props.pageConfig"
          :toolbar="props.toolbar"
          :code="props.code"
        />
      </div>

      <div
        id="landing-demo-source-panel"
        v-show="activeTab === 'source'"
        class="landing-demo__panel landing-demo__panel--source"
        role="tabpanel"
        aria-labelledby="landing-demo-source-tab"
        tabindex="0"
      >
        <pre><code>{{ markdownSource }}</code></pre>
      </div>
    </div>
  </div>
</template>
