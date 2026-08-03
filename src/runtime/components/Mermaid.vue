<script setup lang="ts">
import { useNuxtApp } from '#app'
import { computed, ref, shallowRef, watch } from 'vue'
import type { Component } from 'vue'
import type { MermaidComponentSource } from '../component-configuration'
import {
  collectMermaidComponentSourceDependencies,
  resolveMermaidComponentSource,
} from '../component-configuration'
import BuiltInRenderer from '../built-in-renderer/BuiltInRenderer.vue'
import { selectRenderer } from '../rendererSelection'
import { getRuntimeMermaidSnapshot } from '../runtime-snapshot'
import type { MermaidComponentProps } from '../../types/config'
import Spinner from './Spinner.vue'

const props = defineProps<MermaidComponentProps>()

function resolveCurrentComponentSource() {
  return resolveMermaidComponentSource({
    pageConfig: props.pageConfig,
    config: props.config,
  })
}

const initialComponentSource = resolveCurrentComponentSource()
if (initialComponentSource.kind === 'conflict') throw initialComponentSource.error
const componentSource = shallowRef<MermaidComponentSource>(initialComponentSource)

const nuxtApp = useNuxtApp()
const contentMermaidOptions = getRuntimeMermaidSnapshot(nuxtApp)
const componentOptions = contentMermaidOptions.components || {}
const decodedCode = computed(() => props.code ? decodeURIComponent(props.code) : '')

const configuredSpinnerName = computed(() => componentOptions.spinner?.trim() || '')
const customSpinner = shallowRef<Component | null>(null)
const configuredMermaidImplName = computed(() => componentOptions.renderer?.trim() || '')
const customMermaidImpl = shallowRef<Component | null>(null)
type RenderingOwnership = 'pending' | 'built-in'
const renderingOwnership = ref<RenderingOwnership>(
  configuredMermaidImplName.value ? 'pending' : 'built-in',
)
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

async function loadAppComponent(
  name: string,
  appComponents: Record<string, () => Promise<{ default: Component }>>,
): Promise<Component | null> {
  const target = normalizeIdentifier(name)
  const matchEntry = Object.entries(appComponents).find(([path]) => {
    const base = path.split(/[\\/]/).pop() || ''
    return normalizeIdentifier(base) === target
  })

  if (!matchEntry) return null

  const [, componentLoader] = matchEntry
  const mod = await componentLoader()
  return mod.default || mod
}

async function resolveSpinnerAppComponent(
  name: string,
  appComponents: Record<string, () => Promise<{ default: Component }>>,
): Promise<Component | null> {
  try {
    const component = await loadAppComponent(name, appComponents)
    if (!component) {
      console.warn(
        '[nuxt-content-mermaid] Cannot find spinner component:',
        name,
      )
    }

    return component
  }
  catch (error) {
    console.error(
      '[nuxt-content-mermaid] Failed to load spinner component:',
      error,
    )
    return null
  }
}

if (import.meta.client) {
  const appComponents: Record<string, () => Promise<{ default: Component }>>
    = import.meta.glob<{ default: Component }>('~/components/**/*.{vue,js,ts}')

  watch(
    configuredSpinnerName,
    async (name) => {
      if (!name) {
        customSpinner.value = null
        return
      }

      customSpinner.value = await resolveSpinnerAppComponent(name, appComponents)
    },
    { immediate: true },
  )

  let latestRendererSelectionRequestId = 0
  watch(
    configuredMermaidImplName,
    async (name) => {
      const requestId = ++latestRendererSelectionRequestId
      const outcome = selectRenderer(name, {
        loadComponent: candidate => loadAppComponent(candidate, appComponents),
      })

      if (outcome.status === 'no-candidate') {
        customMermaidImpl.value = null
        renderingOwnership.value = 'built-in'
        return
      }

      customMermaidImpl.value = null
      renderingOwnership.value = 'pending'

      const resolvedOutcome = await outcome.resolution
      if (requestId !== latestRendererSelectionRequestId) return

      if (resolvedOutcome.status === 'resolved') {
        customMermaidImpl.value = resolvedOutcome.component
      }
      else if (resolvedOutcome.status === 'not-found') {
        console.warn(
          '[nuxt-content-mermaid] Cannot find mermaid component:',
          resolvedOutcome.candidate,
        )
      }
      else {
        console.error(
          '[nuxt-content-mermaid] Failed to load mermaid component:',
          resolvedOutcome.error,
        )
      }

      if (resolvedOutcome.status !== 'resolved')
        renderingOwnership.value = 'built-in'
    },
    { immediate: true },
  )
}

watch(
  () => collectMermaidComponentSourceDependencies({
    pageConfig: props.pageConfig,
    config: props.config,
  }),
  () => {
    const wasConflict = componentSource.value.kind === 'conflict'
    const source = resolveCurrentComponentSource()
    componentSource.value = source

    if (source.kind === 'conflict' && !wasConflict)
      throw source.error
  },
  { flush: 'post' },
)
</script>

<template>
  <div class="mermaid-outer-wrapper">
    <component
      :is="customMermaidImpl"
      v-if="customMermaidImpl"
      :spinner="spinnerComponent"
      :code="decodedCode"
    >
      <slot>
        <pre v-if="decodedCode"><code>{{ decodedCode }}</code></pre>
      </slot>
    </component>

    <BuiltInRenderer
      v-else
      v-bind="props"
      :component-source="componentSource"
      :rendering-ownership="renderingOwnership"
      :spinner-component="spinnerComponent"
    >
      <slot>
        <pre v-if="decodedCode"><code>{{ decodedCode }}</code></pre>
      </slot>
      <template
        v-if="$slots.loading"
        #loading
      >
        <slot name="loading" />
      </template>
      <template
        v-if="$slots.error"
        #error="{ error, source }"
      >
        <slot
          name="error"
          :error="error"
          :source="source"
        />
      </template>
    </BuiltInRenderer>
  </div>
</template>
