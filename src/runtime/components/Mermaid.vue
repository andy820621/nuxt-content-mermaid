<script setup lang="ts">
import { useNuxtApp, useRuntimeConfig } from '#app'
import {
  ref,
  onMounted,
  onUnmounted,
  nextTick,
  computed,
  watch,
  shallowRef,
  useTemplateRef,
} from 'vue'

import type { Component, ComputedRef } from 'vue'
import type { MermaidConfig } from 'mermaid'
import type { ModuleOptions } from '../../module'
import { mergeMermaidConfig, resolveMermaidTheme } from '../mermaid-config'
import { enqueueRender } from '../utils'
import Spinner from './Spinner.vue'

const props = defineProps<{
  // Using `unknown` to avoid Vue runtime prop type warnings when user's collection schema is misconfigured; actual validation below.
  config?: MermaidConfig | string | unknown
}>()

const nuxtApp = useNuxtApp()
const runtimeConfig = useRuntimeConfig()
// Get module options from public runtimeConfig `mermaidContent` (configured in nuxt.config.ts)
const mermaidContent = (runtimeConfig.public?.mermaidContent
  || {}) as Partial<ModuleOptions>
const isEnabled = mermaidContent.enabled !== false
const loaderOptions = mermaidContent.loader || {}
const themeOptions = mermaidContent.theme || {}
const componentOptions = mermaidContent.components || {}

const lazyOption = loaderOptions.lazy
const isLazy = lazyOption !== false
const lazyThreshold = typeof lazyOption === 'object' && typeof lazyOption.threshold === 'number'
  ? lazyOption.threshold
  : 0.1

const baseMermaidInit = (loaderOptions.init as MermaidConfig | undefined) || {}
const useColorModeTheme = themeOptions.useColorModeTheme
const lightTheme = themeOptions.light
const darkTheme = themeOptions.dark

const colorMode = nuxtApp.$colorMode as { value: string } | undefined
const { $mermaid } = nuxtApp

const mermaidContainer = useTemplateRef('mermaidContainer')
const hasRenderedOnce = ref(false)
const isLoading = ref(false)
const hasError = ref(false)
const errorContent = shallowRef<unknown | null>(null)

let mermaidDefinition = '' // Mermaid definition extracted from slot content
let observer: IntersectionObserver | null = null

const frontmatterConfig = computed<MermaidConfig | undefined>(() => {
  const value = props.config
  if (!value)
    return undefined

  if (typeof value !== 'object') {
    if (import.meta.dev) {
      console.warn(
        '[nuxt-content-mermaid] Ignoring non-object `config` prop on <Mermaid> component. '
        + 'This usually means your `content.config.ts` collection schema did not declare `config` as a JSON field. '
        + 'See README section about per-page overrides via frontmatter.',
        value,
      )
    }
    return undefined
  }

  return value as MermaidConfig
})

const mermaidTheme = computed(() => {
  return resolveMermaidTheme({
    useColorModeTheme,
    colorModeValue: colorMode?.value,
    frontmatterTheme: frontmatterConfig.value?.theme,
    baseTheme: baseMermaidInit.theme as MermaidConfig['theme'] | undefined,
    lightTheme,
    darkTheme,
  })
})

const effectiveMermaidInit = computed<MermaidConfig>(() => {
  return mergeMermaidConfig({
    baseConfig: baseMermaidInit,
    overrideConfig: frontmatterConfig.value,
    theme: mermaidTheme.value,
  })
})

const configuredSpinnerName = computed(() => componentOptions.spinner?.trim() || '')
const customSpinner = shallowRef<Component | null>(null)
const configuredMermaidImplName = computed(() => componentOptions.renderer?.trim() || '')
const customMermaidImpl = shallowRef<Component | null>(null)
const configuredErrorName = computed(() => componentOptions.error?.trim() || '')
const errorComponent = shallowRef<Component | null>(null)
const spinnerComponent = computed<Component | string>(() => customSpinner.value || Spinner)

function normalizeIdentifier(value: string) {
  return (
    value
      .replace(/\.vue$/i, '')
      .split(/[\\/]/)
      .pop()
      ?.replace(/[\s_-]+/g, '')
      .toLowerCase() || ''
  )
}

async function resolveAppComponent(
  name: string,
  appComponents: Record<string, () => Promise<{ default: Component }>>,
  label: string,
): Promise<Component | null> {
  const target = normalizeIdentifier(name)
  // Search the paths returned by import.meta.glob and return the file whose name matches the given one.
  const matchEntry = Object.entries(appComponents).find(([path]) => {
    const base = path.split(/[\\/]/).pop() || ''
    const normalized = normalizeIdentifier(base)
    return normalized === target
  })

  if (!matchEntry) {
    console.warn(
      `[nuxt-content-mermaid] Cannot find ${label} component:`,
      name,
    )
    return null
  }

  try {
    const [, componentLoader] = matchEntry
    const mod = await componentLoader()
    return mod.default || mod
  }
  catch (error) {
    console.error(
      `[nuxt-content-mermaid] Failed to load ${label} component:`,
      error,
    )
    return null
  }
}

if (import.meta.client && isEnabled) {
  const appComponents: Record<string, () => Promise<{ default: Component }>>
    = import.meta.glob<{ default: Component }>('~/components/**/*.{vue,js,ts}')

  function watchCustomAppComponent(
    nameRef: ComputedRef<string>,
    targetRef: { value: Component | null },
    label: 'spinner' | 'mermaid' | 'error',
  ) {
    watch(
      nameRef,
      async (name) => {
        if (!name) {
          targetRef.value = null
          return
        }

        targetRef.value = await resolveAppComponent(
          name,
          appComponents,
          label,
        )
      },
      { immediate: true },
    )
  }

  watchCustomAppComponent(configuredSpinnerName, customSpinner, 'spinner')
  watchCustomAppComponent(configuredMermaidImplName, customMermaidImpl, 'mermaid')
  watchCustomAppComponent(configuredErrorName, errorComponent, 'error')
}

function serializeMermaidFromNode(root: Node): string {
  const TEXT_NODE = 3
  const ELEMENT_NODE = 1
  if (root.nodeType === TEXT_NODE) {
    return (root as Text).data
  }
  if (root.nodeType === ELEMENT_NODE) {
    const el = root as HTMLElement
    const tag = el.tagName?.toUpperCase()
    if (tag === 'BR') return '<br/>'
    let out = ''
    el.childNodes.forEach((child) => {
      out += serializeMermaidFromNode(child)
    })
    return out
  }
  return ''
}

function extractMermaidDefinition(container: HTMLDivElement) {
  const pre = container.querySelector('pre')
  const code = container.querySelector('code')

  if (code) return code.textContent?.trim() || ''

  if (pre) return pre.textContent?.trim() || ''

  return serializeMermaidFromNode(container).trim()
}

async function renderMermaid() {
  if (!mermaidContainer.value || !mermaidDefinition) return

  // Show spinner while waiting in queue
  isLoading.value = true

  const performRender = async () => {
    // Check if component is still mounted
    if (!mermaidContainer.value) return

    hasError.value = false
    errorContent.value = null

    try {
      const mermaid = await $mermaid()
      mermaid.initialize(effectiveMermaidInit.value)
      mermaidContainer.value.removeAttribute('data-processed')
      mermaidContainer.value.textContent = mermaidDefinition
      await nextTick()

      await mermaid.run({
        nodes: [mermaidContainer.value],
        suppressErrors: true,
      })

      hasRenderedOnce.value = true

      // Add a small delay to ensure unique IDs (Mermaid uses Date.now())
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    catch (error) {
      console.error('[nuxt-content-mermaid]', error)
      hasError.value = true
      errorContent.value = error

      if (mermaidContainer.value)
        mermaidContainer.value.innerHTML = ''
    }
    finally {
      isLoading.value = false
    }
  }

  // Chain the render request
  await enqueueRender(performRender)
}

function setupMermaidContainer() {
  const container = mermaidContainer.value
  if (!container) return

  if (!mermaidDefinition)
    mermaidDefinition = extractMermaidDefinition(container)

  if (!isLazy) {
    renderMermaid()
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !hasRenderedOnce.value) {
        renderMermaid()

        if (observer) observer.disconnect()
      }
    },
    { threshold: lazyThreshold },
  )

  observer.observe(container)
}

onMounted(() => {
  if (!isEnabled) return

  // Extract definition from the same container (including SSR <slot>) to avoid hydration mismatch when switching structure
  if (mermaidContainer.value)
    mermaidDefinition = extractMermaidDefinition(mermaidContainer.value)
  nextTick(() => setupMermaidContainer())
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

watch(mermaidTheme, () => {
  if (!isEnabled) return
  if (hasRenderedOnce.value) renderMermaid()
})

watch(
  frontmatterConfig,
  () => {
    if (!isEnabled) return
    if (hasRenderedOnce.value) renderMermaid()
  },
  { deep: true },
)
</script>

<template>
  <div class="mermaid-outer-wrapper">
    <div
      v-if="!isEnabled"
      class="mermaid-wrapper"
    >
      <div ref="mermaidContainer">
        <slot />
      </div>
    </div>

    <component
      :is="customMermaidImpl"
      v-else-if="customMermaidImpl"
      :spinner="spinnerComponent"
    >
      <slot />
    </component>

    <div
      v-else
      class="mermaid-wrapper"
    >
      <div ref="mermaidContainer">
        <!-- Initially show the slot's <pre><code> for SSR; client-side rendering will replace it with the mermaid SVG -->
        <slot />
      </div>

      <template v-if="isLoading && !hasRenderedOnce">
        <slot name="loading">
          <component :is="spinnerComponent" />
        </slot>
      </template>
      <template v-else-if="hasError">
        <slot
          name="error"
          :error="errorContent"
          :source="mermaidDefinition"
        >
          <component
            :is="errorComponent"
            v-if="errorComponent"
            :error="errorContent"
            :source="mermaidDefinition"
          />

          <div
            v-else
            class="mermaid-error-default"
          >
            ⚠️ Mermaid Diagram Error
          </div>
        </slot>
      </template>
    </div>
  </div>
</template>

<style scoped>
.mermaid-wrapper {
  position: relative;
  text-align: center;
}
.mermaid-wrapper :deep(pre),
.mermaid-wrapper :deep(code) {
  opacity: 0;
  pointer-events: none;
  user-select: none;
  margin: 0;
  max-height: 160px;
  overflow: hidden;
}
.mermaid-error-default {
  text-align: center;
}
.mermaid:not([data-processed]) {
  /* Hide text before Mermaid processes to avoid flickering */
  color: transparent;
  min-height: 10px;
}

/*
  Mermaid's generated label containers sometimes apply overflow: hidden and nowrap,
  which can clip long CJK text. Allow wrapping and visible overflow for node/edge labels.
*/
.mermaid-wrapper :deep(.label),
.mermaid-wrapper :deep(.nodeLabel),
.mermaid-wrapper :deep(.edgeLabel){
  white-space: normal !important;
  overflow: visible !important;
}
/* Some Mermaid themes apply overflow: hidden on foreignObject, forcing it to visible here */
.mermaid-wrapper :deep(foreignObject) {
  overflow: visible !important;
}
</style>
