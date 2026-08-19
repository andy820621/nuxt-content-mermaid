<script setup lang="ts">
import { useNuxtApp } from '#app'
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

import { defu } from 'defu'
import type { Component } from 'vue'
import type { MermaidConfig } from 'mermaid'
import type { MermaidComponentSource } from '../component-configuration'
import { materializeMermaidConfigForInvocation, resolveMermaidTheme } from '../mermaid-config'
import { createMermaidRenderer, renderDetachedMermaidSvg } from '../mermaid-rendering'
import { getRuntimeMermaidSnapshot } from '../runtime-snapshot'
import { downloadStandaloneSvg } from '../svg-download'
import { parseSizeToPx, isRecord } from '../utils'
import { useMermaidTheme } from '../composables/useMermaidTheme'
import { useMermaidCursors } from '../composables/useMermaidCursors'
import type { ExpandOptions } from '../types/expand'
import IconClipboard from '../components/icons/IconClipboard.vue'
import IconClipboardHover from '../components/icons/IconClipboardHover.vue'
import IconClipboardSuccess from '../components/icons/IconClipboardSuccess.vue'
import IconFullScreen from '../components/icons/iconFullScreen.vue'
import IconFullScreenExit from '../components/icons/iconFullScreenExit.vue'
import MermaidExpandOverlay from '../components/MermaidExpandOverlay.vue'
import type { MermaidToolbarLabels, MermaidToolbarOptions } from '../../types/mermaid'
import type { MermaidComponentProps } from '../../types/config'
import IconExpand from '../components/icons/IconExpand.vue'
import IconCollapse from '../components/icons/IconCollapse.vue'
import IconDownload from '../components/icons/IconDownload.vue'
import MermaidFullscreenPresentation from '../components/MermaidFullscreenPresentation.vue'
import { DEFAULT_TOOLBAR_LABELS } from '../constants'

type BuiltInRendererProps = MermaidComponentProps & {
  componentSource: MermaidComponentSource
  spinnerComponent: Component | string
}

interface CommittedExportSnapshot {
  source: string
  config: MermaidConfig
  svg: SVGSVGElement
}

const props = defineProps<BuiltInRendererProps>()
const componentSource = computed(() => props.componentSource)

const nuxtApp = useNuxtApp()
const contentMermaidOptions = getRuntimeMermaidSnapshot(nuxtApp)
const isEnabled = true
const debug = contentMermaidOptions.debug || false
const loaderOptions = contentMermaidOptions.loader || {}
const themeOptions = contentMermaidOptions.theme || {}
const componentOptions = contentMermaidOptions.components || {}

// Expand options and flags
const expandOptions = contentMermaidOptions.expand as unknown as ExpandOptions
const expandEnabled = expandOptions.enabled !== false
const expandOpenOptions = expandOptions.invokeOpenOn || {}
const allowOpenDiagramClick = expandOpenOptions.diagramClick !== false

const lazyOption = loaderOptions.lazy
const isLazy = lazyOption !== false
const lazyThreshold = typeof lazyOption === 'object' && typeof lazyOption.threshold === 'number'
  ? lazyOption.threshold
  : 0.1

const baseMermaidInit = (loaderOptions.init as MermaidConfig | undefined) || {}
const lightTheme = themeOptions.light
const darkTheme = themeOptions.dark

const colorMode = nuxtApp.$colorMode as { value: string } | undefined
const { $mermaid } = nuxtApp
const { currentTheme: manualThemeMode } = useMermaidTheme()

const mermaidBlock = useTemplateRef('mermaidBlock')
const mermaidWrapper = useTemplateRef('mermaidWrapper')
const mermaidContainer = useTemplateRef('mermaidContainer')
const expandButton = useTemplateRef<HTMLButtonElement>('expandButton')
const fullscreenButton = useTemplateRef<HTMLButtonElement>('fullscreenButton')
const getExpandFocusTarget = () => expandButton.value
const getFullscreenFocusTarget = () => fullscreenButton.value
interface MermaidFullscreenPresentationExpose {
  toggle: () => Promise<void>
  endForDiagramReplacement: () => Promise<void>
}
const fullscreenPresentation = useTemplateRef<MermaidFullscreenPresentationExpose>('fullscreenPresentation')
const isFullscreenSupported = ref(false)
const isFullscreen = ref(false)
const handleFullscreenSupportedChange = (supported: boolean) => {
  isFullscreenSupported.value = supported
}
const handleFullscreenActiveChange = (active: boolean) => {
  isFullscreen.value = active
}
const toggleFullscreen = () => {
  expandOverlay.value?.endForDiagramReplacement()
  return fullscreenPresentation.value?.toggle()
}
const hasRenderStarted = ref(false)
const hasRenderedOnce = ref(false)
const isLoading = ref(false)
const hasError = ref(false)
const errorContent = shallowRef<unknown | null>(null)
const committedExportSnapshot = shallowRef<CommittedExportSnapshot | null>(null)
const isPortableDownloadPending = ref(false)

const decodedCode = computed(() => props.code ? decodeURIComponent(props.code) : '')
// Holds the mermaid definition - defaults to decoded prop, falls back to DOM extraction for direct component usage
const mermaidDefinition = ref(decodedCode.value)
let observer: IntersectionObserver | null = null

const runtimeToolbarDefaults = contentMermaidOptions.toolbar
const defaultToolbarTitle = runtimeToolbarDefaults?.title ?? 'mermaid'
const defaultToolbarFontSize = runtimeToolbarDefaults?.fontSize ?? '14px'
const defaultFullscreenToolbarScale = runtimeToolbarDefaults?.fullscreenToolbarScale ?? 1.25

const resolvedToolbar = computed<MermaidToolbarOptions>(() => {
  return defu({}, props.toolbar ?? {}, runtimeToolbarDefaults ?? {})
})
const toolbarLabels = computed<Required<MermaidToolbarLabels>>(() => {
  return defu({}, resolvedToolbar.value.labels ?? {}, DEFAULT_TOOLBAR_LABELS)
})

const toolbarButtons = computed<NonNullable<MermaidToolbarOptions['buttons']>>(() => {
  const buttons = resolvedToolbar.value.buttons
  return isRecord(buttons) ? buttons : {}
})

const toolbarTitle = computed(() => resolvedToolbar.value.title ?? defaultToolbarTitle)
const toolbarFontSize = computed(() => {
  const value = resolvedToolbar.value.fontSize ?? defaultToolbarFontSize

  if (typeof value === 'number')
    return `${value}px`

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d+(?:\.\d+)?$/.test(trimmed))
      return `${trimmed}px`
    return trimmed
  }

  return defaultToolbarFontSize
})
const showCopyButton = computed(() => toolbarButtons.value.copy !== false)
const canDownloadSvg = computed(() => {
  return committedExportSnapshot.value !== null && componentSource.value.kind !== 'conflict'
})
const copySource = computed(() => decodedCode.value || mermaidDefinition.value || '')
const hasCopySource = computed(() => !!copySource.value)

type CopyState = 'idle' | 'copied' | 'error'
const copyState = ref<CopyState>('idle')
const copyLabel = computed(() => {
  if (copyState.value === 'copied') return toolbarLabels.value.copied
  if (copyState.value === 'error') return toolbarLabels.value.copyFailed
  return toolbarLabels.value.copy
})
let copyResetTimer: ReturnType<typeof setTimeout> | null = null
const isCopyHovered = ref(false)
const copyIcon = computed(() => {
  if (copyState.value === 'copied') return IconClipboardSuccess
  if (isCopyHovered.value && hasCopySource.value) return IconClipboardHover
  return IconClipboard
})
const showFullscreenButton = computed(() => toolbarButtons.value.fullscreen !== false && isFullscreenSupported.value)
const fullscreenLabel = computed(() => isFullscreen.value
  ? toolbarLabels.value.exitFullscreen
  : toolbarLabels.value.enterFullscreen)
const fullscreenToolbarScale = computed(() => {
  const raw = resolvedToolbar.value.fullscreenToolbarScale ?? defaultFullscreenToolbarScale
  if (typeof raw === 'number' && Number.isFinite(raw))
    return raw
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw)
    if (Number.isFinite(parsed))
      return parsed
  }
  return defaultFullscreenToolbarScale
})
const toolbarFontSizePx = computed(() => {
  return parseSizeToPx(resolvedToolbar.value.fontSize ?? defaultToolbarFontSize, 14)
})
const fullscreenToolbarFontSize = computed(() => {
  const scaled = toolbarFontSizePx.value * fullscreenToolbarScale.value
  return `${Math.round(scaled * 100) / 100}px`
})
const effectiveToolbarFontSize = computed(() => {
  return isFullscreen.value ? fullscreenToolbarFontSize.value : toolbarFontSize.value
})
const effectiveToolbarFontSizePx = computed(() => {
  const baseSize = toolbarFontSizePx.value
  return isFullscreen.value ? baseSize * fullscreenToolbarScale.value : baseSize
})

const diagramSourceConfig = computed<MermaidConfig | undefined>(() => {
  const source = componentSource.value
  return source.kind === 'runtime-only' || source.kind === 'conflict'
    ? undefined
    : source.config as MermaidConfig
})

const mermaidTheme = computed(() => {
  return resolveMermaidTheme({
    colorModeValue: colorMode?.value,
    manualThemeMode: manualThemeMode.value,
    frontmatterTheme: diagramSourceConfig.value?.theme,
    baseTheme: baseMermaidInit.theme as MermaidConfig['theme'] | undefined,
    lightTheme,
    darkTheme,
  })
})

function materializeEffectiveMermaidInit(): MermaidConfig {
  const source = componentSource.value
  if (source.kind === 'conflict') throw source.error

  return materializeMermaidConfigForInvocation({
    runtimeConfig: baseMermaidInit,
    source,
    theme: mermaidTheme.value,
  })
}

const configuredErrorName = computed(() => componentOptions.error?.trim() || '')
const errorComponent = shallowRef<Component | null>(null)
const spinnerComponent = computed(() => props.spinnerComponent)

// Calculate icon size based on toolbar font size (approximately 1.2x the font size)
const iconSize = computed(() => {
  return Math.round(effectiveToolbarFontSizePx.value * 1.2)
})
const isExpandBlocked = computed(() => !isEnabled || !expandEnabled || isLoading.value || hasError.value || isFullscreen.value)

interface MermaidExpandOverlayExpose {
  toggle: (event?: Event) => void
  openFromDiagram: (event: MouseEvent) => void
  endForDiagramReplacement: () => void
}

const expandOverlay = useTemplateRef<MermaidExpandOverlayExpose>('expandOverlay')
const isExpandActive = ref(false)
const expandToolbarLabel = computed(() => isExpandActive.value
  ? toolbarLabels.value.collapse
  : toolbarLabels.value.expand)
const handleExpandActiveChange = (active: boolean) => {
  isExpandActive.value = active
}
const toggleExpand = (event?: Event) => expandOverlay.value?.toggle(event)
const handleMermaidClick = (event: MouseEvent) => expandOverlay.value?.openFromDiagram(event)

let requestBuiltInRender: ReturnType<typeof createMermaidRenderer> | undefined

function getBuiltInRenderRequest() {
  requestBuiltInRender ??= createMermaidRenderer({
    loadMermaid: $mermaid,
    readRenderData: () => {
      if (componentSource.value.kind === 'conflict') {
        return {
          source: null,
          config: {},
          target: mermaidContainer.value,
        }
      }

      return {
        source: mermaidDefinition.value,
        config: materializeEffectiveMermaidInit(),
        target: mermaidContainer.value,
      }
    },
    beforeCommit: () => {
      if (import.meta.client) {
        expandOverlay.value?.endForDiagramReplacement()
        void fullscreenPresentation.value?.endForDiagramReplacement()
      }

      hasError.value = false
      errorContent.value = null
    },
    debug,
  })

  return requestBuiltInRender
}

const showExpandToolbarButton = computed(() => {
  if (!expandEnabled) return false
  if (toolbarButtons.value.expand === false) return false
  if (isExpandActive.value) return false
  if (isFullscreen.value) return false
  return true
})

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
  // Search the paths returned by import.meta.glob and return the file whose name matches the given one.
  const matchEntry = Object.entries(appComponents).find(([path]) => {
    const base = path.split(/[\\/]/).pop() || ''
    const normalized = normalizeIdentifier(base)
    return normalized === target
  })

  if (!matchEntry) return null

  const [, componentLoader] = matchEntry
  const mod = await componentLoader()
  return mod.default || mod
}

async function resolveErrorAppComponent(
  name: string,
  appComponents: Record<string, () => Promise<{ default: Component }>>,
): Promise<Component | null> {
  try {
    const component = await loadAppComponent(name, appComponents)
    if (!component) {
      console.warn(
        '[nuxt-content-mermaid] Cannot find error component:',
        name,
      )
    }

    return component
  }
  catch (error) {
    console.error(
      '[nuxt-content-mermaid] Failed to load error component:',
      error,
    )
    return null
  }
}

if (import.meta.client && isEnabled) {
  const appComponents: Record<string, () => Promise<{ default: Component }>>
    = import.meta.glob<{ default: Component }>('~/components/**/*.{vue,js,ts}')

  watch(
    configuredErrorName,
    async (name) => {
      if (!name) {
        errorComponent.value = null
        return
      }

      errorComponent.value = await resolveErrorAppComponent(name, appComponents)
    },
    { immediate: true },
  )
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

function getMermaidSvg(): SVGSVGElement | null {
  if (!mermaidContainer.value) return null
  const svg = mermaidContainer.value.querySelector('svg')
  return svg instanceof SVGSVGElement ? svg : null
}

function downloadFaithfulSvg() {
  const snapshot = committedExportSnapshot.value
  if (!canDownloadSvg.value || !snapshot) return
  downloadStandaloneSvg(snapshot.svg, {
    filename: 'mermaid-diagram-faithful.svg',
  })
}

async function downloadPortableSvg() {
  const snapshot = committedExportSnapshot.value
  if (!canDownloadSvg.value || !snapshot || isPortableDownloadPending.value)
    return

  isPortableDownloadPending.value = true
  try {
    const portableSvg = await renderDetachedMermaidSvg({
      loadMermaid: $mermaid,
      source: snapshot.source,
      config: {
        ...snapshot.config,
        htmlLabels: false,
      },
      document: snapshot.svg.ownerDocument,
    })
    const foreignObjectCount
      = portableSvg.querySelectorAll('foreignObject').length
    if (foreignObjectCount > 0) {
      const elementLabel = foreignObjectCount === 1 ? 'element' : 'elements'
      console.warn(
        '[nuxt-content-mermaid] Portable SVG still contains '
        + foreignObjectCount
        + ' foreignObject '
        + elementLabel
        + '.',
      )
    }
    downloadStandaloneSvg(portableSvg, {
      filename: 'mermaid-diagram-portable.svg',
    })
  }
  catch (error) {
    console.error(
      '[nuxt-content-mermaid] Failed to create portable SVG:',
      error,
    )
  }
  finally {
    isPortableDownloadPending.value = false
  }
}

function getMermaidViewport(): HTMLDivElement | null {
  return mermaidWrapper.value
}

function stopLazyObservation() {
  const activeObserver = observer
  observer = null
  activeObserver?.takeRecords()
  activeObserver?.disconnect()
}

async function renderMermaid() {
  if (componentSource.value.kind === 'conflict') return

  const request = getBuiltInRenderRequest()

  hasRenderStarted.value = true
  stopLazyObservation()
  isLoading.value = true

  const outcome = await request()

  if (outcome.status === 'stale')
    return

  if (outcome.status === 'success') {
    hasRenderedOnce.value = true
    const committedSvg = getMermaidSvg()
    committedExportSnapshot.value = committedSvg
      ? {
          source: outcome.source,
          config: outcome.config,
          svg: committedSvg.cloneNode(true) as SVGSVGElement,
        }
      : null
  }
  else if (outcome.status === 'failure') {
    console.error('[nuxt-content-mermaid]', outcome.error)
    hasError.value = true
    errorContent.value = outcome.error
  }

  isLoading.value = false
}

function setupMermaidContainer() {
  const container = mermaidContainer.value
  if (!container) return

  if (!isLazy) {
    renderMermaid()
    return
  }

  const nextObserver = new IntersectionObserver(
    (entries) => {
      if (observer !== nextObserver) return
      if (entries[0]?.isIntersecting && !hasRenderedOnce.value)
        renderMermaid()
    },
    { threshold: lazyThreshold },
  )

  observer = nextObserver
  nextObserver.observe(container)
}

async function copyMermaidSource() {
  if (!copySource.value) return

  const copied = await copyToClipboard(copySource.value)
  copyState.value = copied ? 'copied' : 'error'

  if (copyResetTimer)
    clearTimeout(copyResetTimer)

  copyResetTimer = setTimeout(() => {
    copyState.value = 'idle'
  }, 2000)
}

async function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    }
    catch {
      // fall through to fallback
    }
  }

  if (typeof document === 'undefined')
    return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  let copied = false
  try {
    copied = document.execCommand('copy')
  }
  catch {
    copied = false
  }
  finally {
    document.body.removeChild(textarea)
  }

  return copied
}

onMounted(() => {
  if (!isEnabled) return

  // Extract definition: prefer code prop, fallback to DOM extraction for direct component usage
  if (!mermaidDefinition.value && mermaidContainer.value)
    mermaidDefinition.value = extractMermaidDefinition(mermaidContainer.value)

  nextTick(() => setupMermaidContainer())
})

onUnmounted(() => {
  requestBuiltInRender?.invalidate()
  stopLazyObservation()
  if (copyResetTimer) clearTimeout(copyResetTimer)
})

// Resolve every reactive render input at one post-flush boundary so a Vue update
// batch produces one conflict outcome or one latest Render Request, never both.
watch(
  () => ({
    componentSource: componentSource.value,
    code: decodedCode.value,
    colorMode: colorMode?.value,
    manualThemeMode: manualThemeMode.value,
  }),
  ({ code, componentSource: source }, previousInputs) => {
    if (code !== previousInputs.code)
      mermaidDefinition.value = code

    const wasConflict = previousInputs.componentSource.kind === 'conflict'

    if (source.kind === 'conflict') {
      if (wasConflict) return

      requestBuiltInRender?.invalidate()
      isLoading.value = false
      return
    }

    if (!isEnabled) return
    if (wasConflict || hasRenderStarted.value) renderMermaid()
  },
  { flush: 'post' },
)

// Dynamic Cursor Generation
const { cursorVariables } = useMermaidCursors(iconSize, expandEnabled)
</script>

<template>
  <div
    ref="mermaidBlock"
    class="mermaid-block"
    :style="{ '--ncm-icon-size': `${iconSize}px` }"
  >
    <!-- Toolbar: Title and Actions -->
    <div class="mermaid-toolbar">
      <div
        class="mermaid-title"
        :style="{ fontSize: effectiveToolbarFontSize }"
      >
        <span v-if="toolbarTitle">{{ toolbarTitle }}</span>
      </div>
      <div class="mermaid-actions">
        <button
          v-if="showCopyButton"
          type="button"
          class="mermaid-btn"
          :title="copyLabel"
          :aria-label="copyLabel"
          :disabled="!hasCopySource"
          @click="copyMermaidSource"
          @mouseenter="isCopyHovered = true"
          @mouseleave="isCopyHovered = false"
        >
          <component
            :is="copyIcon"
            :size="iconSize"
          />
        </button>
        <button
          type="button"
          class="mermaid-btn"
          title="Download faithful SVG"
          aria-label="Download faithful SVG"
          :disabled="!canDownloadSvg"
          @click="downloadFaithfulSvg"
        >
          <IconDownload :size="iconSize" />
        </button>
        <button
          type="button"
          class="mermaid-btn"
          title="Download portable SVG"
          aria-label="Download portable SVG"
          :disabled="!canDownloadSvg || isPortableDownloadPending"
          @click="downloadPortableSvg"
        >
          <IconDownload :size="iconSize" />
        </button>
        <button
          v-if="showExpandToolbarButton"
          ref="expandButton"
          type="button"
          class="mermaid-btn"
          :title="expandToolbarLabel"
          :aria-label="expandToolbarLabel"
          @click="toggleExpand"
        >
          <IconExpand
            v-if="!isExpandActive"
            :size="iconSize"
          />
          <IconCollapse
            v-else
            :size="iconSize"
          />
        </button>
        <button
          v-if="showFullscreenButton"
          ref="fullscreenButton"
          type="button"
          class="mermaid-btn"
          :title="fullscreenLabel"
          :aria-label="fullscreenLabel"
          @click="toggleFullscreen"
        >
          <IconFullScreen
            v-if="!isFullscreen"
            :size="iconSize"
          />
          <IconFullScreenExit
            v-else
            :size="iconSize"
          />
        </button>
      </div>
    </div>

    <MermaidFullscreenPresentation
      ref="fullscreenPresentation"
      :fullscreen-target="mermaidBlock"
      :viewport-target="mermaidWrapper"
      :render-target="mermaidContainer"
      :icon-size="iconSize"
      :labels="toolbarLabels"
      :get-focus-target="getFullscreenFocusTarget"
      @active-change="handleFullscreenActiveChange"
      @supported-change="handleFullscreenSupportedChange"
    />

    <!-- Diagram Container -->
    <div
      ref="mermaidWrapper"
      class="mermaid-wrapper"
      :class="{
        'ncm-is-loading': isLoading && !hasRenderedOnce,
        'ncm-expand-hidden': isExpandActive,
        'ncm-expand-clickable': expandEnabled && allowOpenDiagramClick && !isFullscreen,
        'ncm-fullscreen-zoom': isFullscreen,
      }"
      :style="cursorVariables"
      @click="handleMermaidClick"
    >
      <div
        ref="mermaidContainer"
        class="mermaid"
      >
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

    <MermaidExpandOverlay
      ref="expandOverlay"
      :options="expandOptions"
      :blocked="isExpandBlocked"
      :get-expand-target="getMermaidSvg"
      :get-expand-viewport="getMermaidViewport"
      :get-return-focus-target="getExpandFocusTarget"
      :overlay-style="cursorVariables"
      :content-style="cursorVariables"
      :icon-size="iconSize"
      :labels="toolbarLabels"
      :dialog-label="toolbarTitle || toolbarLabels.expand"
      @active-change="handleExpandActiveChange"
    />
  </div>
</template>

<style scoped>
.mermaid-block {
  border: var(--ncm-border);
  border-radius: 4px;
  background-color: var(--ncm-code-bg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 1rem 0;
  /* Calculate toolbar height based on icon size for dynamic positioning */
  /* padding (6px top + 6px bottom) + button (4px + icon + 4px) = icon + 20px */
  --ncm-toolbar-height: calc(var(--ncm-icon-size, 17px) + 20px);
}

/* Toolbar */
.mermaid-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.375rem 0.375rem 0.75rem;
  border-bottom: var(--ncm-border-bottom);
  background-color: var(--ncm-code-bg);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  /* Ensure toolbar stays on top in fullscreen */
  z-index: 20;
}

.mermaid-title {
  line-height: 1.25;
  letter-spacing: 0;
  font-weight: 500;
  color: var(--ncm-text-muted);
  padding: 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}
:fullscreen .mermaid-title {
  max-width: 80%;
}

.mermaid-actions {
  justify-self: flex-end;
  display: flex;
  gap: 0;
}

.mermaid-btn {
  background: var(--ncm-code-bg);
  border: none;
  cursor: pointer;
  line-height: 1.25;
  padding: 4px;
  color: var(--ncm-text-xmuted);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background-color 0.2s;
}

.mermaid-btn:hover {
  color: var(--ncm-text);
  background-color: var(--ncm-code-bg-hover);
}
.mermaid-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  color: var(--ncm-text-xmuted);
}

/* Container */
.mermaid-wrapper {
  position: relative;
  overflow: auto;
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;

  /* Scrollbar customization */
  --sb-thumb: rgba(0, 0, 0, 0.2);
  --sb-thumb-hover: rgba(0, 0, 0, 0.35);
}
.mermaid-wrapper > div {
  width: 100%;
  height: 100%;
}
.mermaid-wrapper > div > :deep(svg) {
  display: block;
  margin: 0 auto;
}
.mermaid-wrapper :deep(pre),
.mermaid-wrapper :deep(code) {
  /* Hide SSR fallback text before Mermaid renders. */
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.mermaid:not([data-processed]) {
  color: transparent;
  min-height: 100px;
}

/* Fullscreen styles */
:fullscreen .mermaid-wrapper {
  overflow: hidden; /* Disable scroll in fullscreen */
  touch-action: none; /* Important for drag gestures */
  flex: 1;
}

:fullscreen .mermaid-wrapper::-webkit-scrollbar {
  display: none;
}

:fullscreen .mermaid-wrapper :deep(svg) {
  height: 100% !important;
  width: 100% !important;
  max-width: none !important;
  max-height: none !important;
}

:global(.dark .mermaid-wrapper) {
  --sb-thumb: rgba(255, 255, 255, 0.2);
  --sb-thumb-hover: rgba(255, 255, 255, 0.35);
}

.mermaid-wrapper::-webkit-scrollbar {
  width: 14px;
}

.mermaid-wrapper::-webkit-scrollbar-track {
  background: rgba(240, 240, 240, 0.08);
}
:global(.dark .mermaid-wrapper::-webkit-scrollbar-track) {
  background: rgba(24, 24, 24, 0.08);
}

.mermaid-wrapper::-webkit-scrollbar-corner {
  background: transparent;
}

.mermaid-wrapper::-webkit-scrollbar-thumb {
  background-color: var(--sb-thumb);
  border: 3px solid transparent;
  border-radius: 10px;
  background-clip: content-box;
}

.mermaid-wrapper::-webkit-scrollbar-thumb:hover {
  background-color: var(--sb-thumb-hover);
}
.mermaid-wrapper.ncm-is-loading {
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mermaid-wrapper.ncm-expand-hidden {
  opacity: 0;
  pointer-events: none;
}
.mermaid-wrapper.ncm-expand-clickable :deep(svg) {
  cursor: var(--ncm-cursor-expand);
}

.mermaid-error-default {
  color: #ff5555;
  padding: 1rem;
  white-space: pre-wrap;
  font-family: monospace;
}
</style>
