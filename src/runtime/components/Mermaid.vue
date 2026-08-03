<script setup lang="ts">
import { useNuxtApp } from '#app'
import { computed, shallowRef, watch } from 'vue'
import type { Component } from 'vue'
import type { MermaidComponentSource } from '../component-configuration'
import {
  collectMermaidComponentSourceDependencies,
  resolveMermaidComponentSource,
} from '../component-configuration'
import { MERMAID_LOG_PREFIX } from '../constants'
import BuiltInRenderer from '../built-in-renderer/BuiltInRenderer.vue'
import {
  createRendererResolutionFailureHandoff,
  selectRenderer,
} from '../rendererSelection'
import { createRendererSelectionAttemptCoordinator } from '../rendererSelectionOrchestration'
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
type RendererSelectionState
  = | { readonly status: 'pending', readonly component?: never }
    | { readonly status: 'built-in', readonly component?: never }
    | { readonly status: 'custom', readonly component: Component }
const rendererSelectionState = shallowRef<RendererSelectionState>(
  configuredMermaidImplName.value
    ? { status: 'pending' }
    : { status: 'built-in' },
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

  const beginRendererSelectionAttempt = createRendererSelectionAttemptCoordinator()
  watch(
    configuredMermaidImplName,
    async (name) => {
      const commitRendererSelectionAttempt = beginRendererSelectionAttempt()
      const outcome = selectRenderer(name, {
        loadComponent: candidate => loadAppComponent(candidate, appComponents),
      })

      if (outcome.status === 'no-candidate') {
        rendererSelectionState.value = { status: 'built-in' }
        return
      }

      rendererSelectionState.value = { status: 'pending' }

      const commitResolutionFailure = createRendererResolutionFailureHandoff({
        reportDiagnostic: (diagnostic) => {
          const failureContext = diagnostic.reason === 'load-failed'
            ? [diagnostic.error]
            : []

          console.warn(
            MERMAID_LOG_PREFIX,
            `Custom Renderer Candidate "${diagnostic.candidate}" resolution failed (${diagnostic.reason}).`,
            diagnostic,
            ...failureContext,
          )
        },
        commitBuiltInOwnership: () => {
          rendererSelectionState.value = { status: 'built-in' }
        },
      })

      const resolvedOutcome = await outcome.resolution
      commitRendererSelectionAttempt(resolvedOutcome, {
        commitCustomOwnership: (component) => {
          rendererSelectionState.value = {
            status: 'custom',
            component,
          }
        },
        commitResolutionFailure,
      })
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
      :is="rendererSelectionState?.component"
      v-if="rendererSelectionState?.status === 'custom'"
      :spinner="spinnerComponent"
      :code="decodedCode"
    >
      <slot>
        <pre v-if="decodedCode"><code>{{ decodedCode }}</code></pre>
      </slot>
    </component>

    <template v-else-if="rendererSelectionState?.status === 'pending'">
      <slot>
        <pre v-if="decodedCode"><code>{{ decodedCode }}</code></pre>
      </slot>
    </template>

    <BuiltInRenderer
      v-else
      v-bind="props"
      :component-source="componentSource"
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
