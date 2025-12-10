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
  code?: string
}>()

const nuxtApp = useNuxtApp()
const runtimeConfig = useRuntimeConfig()
// Get module options from public runtimeConfig (prefers `contentMermaid`, falls back to deprecated `mermaidContent`)
const contentMermaidOptions = (runtimeConfig.public?.contentMermaid
  || runtimeConfig.public?.mermaidContent
  || {}) as Partial<ModuleOptions>
const isEnabled = contentMermaidOptions.enabled !== false
const debug = contentMermaidOptions.debug || false
const loaderOptions = contentMermaidOptions.loader || {}
const themeOptions = contentMermaidOptions.theme || {}
const componentOptions = contentMermaidOptions.components || {}

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

const decodedCode = computed(() => props.code ? decodeURIComponent(props.code) : '')
// Holds the mermaid definition - defaults to decoded prop, falls back to DOM extraction for direct component usage
const mermaidDefinition = ref(decodedCode.value)
let observer: IntersectionObserver | null = null

const frontmatterConfig = computed<MermaidConfig | undefined>(() => {
  const value = props.config
  if (!value)
    return undefined

  if (typeof value !== 'object') {
    // Only warn if it looks like a schema misconfiguration (received a primitive type)
    // Skip warning for null or undefined (which are valid when config is optional in schema)
    if (import.meta.dev && value !== null && value !== undefined) {
      console.warn(
        '[nuxt-content-mermaid] Received non-object `config` prop on <Mermaid> component. '
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
    if (tag === 'BR') return '\n'

    const blockTags = [
      'DIV', 'P', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'BLOCKQUOTE', 'PRE', 'UL', 'OL', 'DL', 'DT', 'DD',
      'TABLE', 'THEAD', 'TBODY', 'TFOOT',
      'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'MAIN',
    ]

    const isBlock
      = blockTags.includes(tag)
        || el.classList.contains('line') // Nuxt Content / Shiki
        || el.classList.contains('code-line') // Other code highlighters

    let out = ''
    el.childNodes.forEach((child) => {
      out += serializeMermaidFromNode(child)
    })

    if (isBlock) return '\n' + out + '\n'

    return out
  }
  return ''
}

function extractMermaidDefinition(container: HTMLDivElement) {
  const codeNodes = Array.from(container.querySelectorAll('code'))

  if (codeNodes.length > 0) {
    return codeNodes
      .map(node => serializeMermaidFromNode(node))
      .join('\n')
      .trim()
  }

  const pre = container.querySelector('pre')
  if (pre) return serializeMermaidFromNode(pre).trim()

  return serializeMermaidFromNode(container).trim()
}

async function renderMermaid() {
  if (!mermaidContainer.value || !mermaidDefinition.value) return

  // Show spinner while waiting in queue
  isLoading.value = true

  const performRender = async () => {
    // Check if component is still mounted
    if (!mermaidContainer.value) return

    hasError.value = false
    errorContent.value = null

    const startTime = performance.now()

    try {
      const mermaid = await $mermaid()
      // Re-initialize with current config (theme changes, frontmatter overrides, etc.)
      mermaid.initialize(effectiveMermaidInit.value)
      mermaidContainer.value.removeAttribute('data-processed')
      mermaidContainer.value.textContent = mermaidDefinition.value
      await nextTick()

      await mermaid.run({
        nodes: [mermaidContainer.value],
        suppressErrors: !debug,
      })

      hasRenderedOnce.value = true

      if (debug) {
        const endTime = performance.now()
        console.log(`[nuxt-content-mermaid] ⏱️  Rendered in ${(endTime - startTime).toFixed(2)}ms`)
      }
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
  await enqueueRender(performRender, debug)
}

function setupMermaidContainer() {
  const container = mermaidContainer.value
  if (!container) return

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

  // Extract definition: prefer code prop, fallback to DOM extraction for direct component usage
  if (!mermaidDefinition.value && mermaidContainer.value)
    mermaidDefinition.value = extractMermaidDefinition(mermaidContainer.value)
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

watch(decodedCode, (newCode) => {
  if (!isEnabled) return
  mermaidDefinition.value = newCode
  if (hasRenderedOnce.value) renderMermaid()
})
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
      :code="decodedCode"
    >
      <slot>
        <pre v-if="decodedCode"><code>{{ decodedCode }}</code></pre>
      </slot>
    </component>

    <div
      v-else
      class="mermaid-wrapper"
    >
      <div ref="mermaidContainer">
        <!-- Initially show the slot's <pre><code> for SSR; client-side rendering will replace it with the mermaid SVG -->
        <slot>
          <pre v-if="decodedCode"><code>{{ decodedCode }}</code></pre>
        </slot>
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
.mermaid-wrapper :deep(svg) {
  display: inline-block;
  vertical-align: middle;
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
