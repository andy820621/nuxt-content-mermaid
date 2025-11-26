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
} from 'vue'

import type { Component } from 'vue'
import type { MermaidConfig } from 'mermaid'
import type { ModuleOptions } from '../../module'
import Spinner from './Spinner.vue'

const nuxtApp = useNuxtApp()
const runtimeConfig = useRuntimeConfig()
const mermaidRuntime = (runtimeConfig.public?.mermaidContent
  || {}) as Partial<ModuleOptions>
const isEnabled = mermaidRuntime.enabled !== false
const loaderOptions = mermaidRuntime.loader || {}
const themeOptions = mermaidRuntime.theme || {}
const componentOptions = mermaidRuntime.components || {}
const colorMode = nuxtApp.$colorMode as { value: string } | undefined
const { $mermaid } = nuxtApp
const mermaidContainer = ref<HTMLDivElement | null>(null)
const isMounted = ref(false)
const hasRenderedOnce = ref(false)
const isLoading = ref(false)
let mermaidDefinition = ''
let observer: IntersectionObserver | null = null
const baseMermaidInit
  = (loaderOptions.init as MermaidConfig | undefined) || {}
const useColorModeTheme = themeOptions.useColorModeTheme
const lightTheme = themeOptions.light
const darkTheme = themeOptions.dark

const mermaidTheme = computed(() => {
  // Color-mode aware path
  if (useColorModeTheme && colorMode)
    return colorMode.value === 'dark' ? darkTheme : lightTheme

  // Static path: prefer loader.init.theme, then fall back to configured light -> dark
  return (
    (baseMermaidInit.theme as MermaidConfig['theme'] | undefined)
    ?? lightTheme
    ?? darkTheme
  )
})

const configuredSpinnerName = computed(
  () => componentOptions.spinner?.trim() || '',
)
const customSpinner = shallowRef<Component | null>(null)
const configuredMermaidImplName = computed(
  () => componentOptions.renderer?.trim() || '',
)
const customMermaidImpl = shallowRef<Component | null>(null)

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
  const matchEntry = Object.entries(appComponents).find(([path]) => {
    const base = path.split(/[\\/]/).pop() || ''
    const normalized = normalizeIdentifier(base)
    return normalized === target
  })

  if (!matchEntry) {
    console.warn(
      `[nuxt-mermaid-content] Cannot find ${label} component:`,
      name,
    )
    return null
  }

  try {
    const [, loader] = matchEntry
    const mod = await loader()
    return mod.default || (mod as unknown as Component)
  }
  catch (error) {
    console.error(
      `[nuxt-mermaid-content] Failed to load ${label} component:`,
      error,
    )
    return null
  }
}

if (import.meta.client && isEnabled) {
  const appComponents: Record<string, () => Promise<{ default: Component }>>
    = import.meta.glob<{ default: Component }>('~/components/**/*.{vue,js,ts}')

  watch(
    configuredSpinnerName,
    async (name) => {
      if (!name) {
        customSpinner.value = null
        return
      }
      customSpinner.value = await resolveAppComponent(
        name,
        appComponents,
        'spinner',
      )
    },
    { immediate: true },
  )

  watch(
    configuredMermaidImplName,
    async (name) => {
      if (!name) {
        customMermaidImpl.value = null
        return
      }

      customMermaidImpl.value = await resolveAppComponent(
        name,
        appComponents,
        'mermaid',
      )
    },
    { immediate: true },
  )
}

const spinnerComponent = computed<Component | string>(() => {
  return customSpinner.value || Spinner
})

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

async function renderMermaid() {
  if (!mermaidContainer.value || !mermaidDefinition) return
  try {
    isLoading.value = true
    const mermaid = await $mermaid()
    const theme = mermaidTheme.value
    const initOptions: MermaidConfig = {
      startOnLoad: false,
      ...baseMermaidInit,
      theme,
    }
    mermaid.initialize(initOptions)
    mermaidContainer.value.removeAttribute('data-processed')
    mermaidContainer.value.textContent = mermaidDefinition
    await nextTick()
    await mermaid.run({
      nodes: [mermaidContainer.value],
      suppressErrors: true,
    })
    hasRenderedOnce.value = true
    isLoading.value = false
  }
  catch (error) {
    console.error('[nuxt-mermaid-content]', error)
    if (mermaidContainer.value)
      mermaidContainer.value.innerHTML = '⚠️ Mermaid Diagram Error'
    isLoading.value = false
  }
}

function setupMermaidContainer() {
  if (mermaidContainer.value) {
    // Extract content from <code> or <pre> tags (Nuxt Content wraps ``` blocks in these)
    const pre = mermaidContainer.value.querySelector('pre')
    const code = mermaidContainer.value.querySelector('code')

    if (code) {
      // Prefer <code> content (most common for ``` blocks)
      mermaidDefinition = code.textContent?.trim() || ''
    }
    else if (pre) {
      // Fallback to <pre> if no <code>
      mermaidDefinition = pre.textContent?.trim() || ''
    }
    else {
      // Last resort: serialize the entire slot
      mermaidDefinition = serializeMermaidFromNode(
        mermaidContainer.value,
      ).trim()
    }

    observer = new IntersectionObserver(
      (entries) => {
        // If the element is visible and we haven't rendered it yet
        if (entries[0]?.isIntersecting && !hasRenderedOnce.value) {
          renderMermaid()

          // Disconnect the observer after the first successful render
          if (observer) {
            observer.disconnect()
          }
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(mermaidContainer.value)
  }
}

onMounted(async () => {
  if (!isEnabled) return
  isMounted.value = true
  await nextTick()
  setupMermaidContainer()
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

watch(mermaidTheme, () => {
  if (!isEnabled) return
  if (hasRenderedOnce.value) renderMermaid()
})
</script>

<template>
  <component
    :is="customMermaidImpl"
    v-if="customMermaidImpl"
  >
    <slot />
  </component>

  <div
    v-else-if="!isEnabled"
    class="mermaid"
  >
    <slot />
  </div>

  <div
    v-else-if="isMounted"
    class="mermaid-wrapper"
  >
    <div
      ref="mermaidContainer"
      class="mermaid"
    >
      <slot />
    </div>

    <template v-if="isLoading && !hasRenderedOnce">
      <slot name="loading">
        <component :is="spinnerComponent" />
      </slot>
    </template>
  </div>

  <div
    v-else
    class="mermaid"
  >
    <slot />
  </div>
</template>

<style scoped>
.mermaid-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}
.mermaid:not([data-processed]) {
  color: transparent;
  min-height: 10px; /* Give it a minimum height so the observer can see it */
}
.mermaid {
  display: flex;
  justify-content: center;
}
/*
  Mermaid's generated label containers sometimes apply overflow: hidden and nowrap,
  which can clip long CJK text. Allow wrapping and visible overflow for node/edge labels.
*/
.mermaid .label,
.mermaid .nodeLabel,
.mermaid .edgeLabel {
  white-space: normal !important;
  overflow: visible !important;
}
/* In some themes, the foreignObject wrapper can also clip; make it visible. */
.mermaid foreignObject {
  overflow: visible !important;
}
</style>
