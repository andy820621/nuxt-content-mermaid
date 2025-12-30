import {
  defineNuxtModule,
  createResolver,
  addPlugin,
  addComponent,
  addTypeTemplate,
  addVitePlugin,
  addImports,
  useLogger,
} from '@nuxt/kit'
import { defu } from 'defu'
import type { FileBeforeParseHook } from '@nuxt/content'
import type { MermaidConfig } from 'mermaid'
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_MERMAID_CONFIG,
  DEFAULT_TOOLBAR_OPTIONS,
  DEFAULT_EXPAND_OPTIONS,
  DEFAULT_FRONTMATTER_CONFIG_KEY,
} from './runtime/constants'
import type { ExpandOptions } from './runtime/types/expand'
import {
  applyMermaidFrontmatterOverrides,
  extractMermaidInlineOverrides,
  extractToolbarProps,
  mergeToolbarProps,
  parseInlineAttrs,
  parseMermaidFrontmatter,
} from './runtime/utils/mermaid-transform'
import {
  isNonEmptyRecord,
  stringifyInlineValue,
} from './runtime/utils'
import type { MermaidToolbarOptions } from './types/mermaid'

const SANITIZE_URL_PACKAGE = '@braintree/sanitize-url'
const MERMAID_FENCE_RE = /^[ \t]*(?:`{3,}|~{3,})[ \t]*mermaid(?:$|[ \t{[])/im

export interface ModuleOptions {
  /**
   * Whether to enable the entire Mermaid process
   * @default true
   */
  enabled?: boolean
  /**
   * Enable debug mode for detailed logging and error reporting
   * @default false
   */
  debug?: boolean
  /**
   * Options related to loading mermaid
   */
  loader?: {
    /**
     * Pass-through to `mermaid.initialize`
     */
    init?: MermaidConfig
    /**
     * Whether to lazy load the diagram when it enters the viewport.
     * Can be a boolean or an object with IntersectionObserver options.
     * @default true
     */
    lazy?: boolean | { threshold?: number }
  }
  /**
   * Options related to theme handling
   */
  theme?: {
    /**
     * @deprecated The module now automatically detects and syncs with @nuxtjs/color-mode.
     * This option no longer has any effect and will be removed in a future version.
     */
    useColorModeTheme?: boolean
    light?: MermaidConfig['theme']
    dark?: MermaidConfig['theme']
  }
  /**
   * Names for custom implementation components
   */
  components?: {
    /**
     * Custom Mermaid implementation component name (e.g., 'MyMermaid').
     * The Markdown transformation phase always outputs `<Mermaid>`, this setting only affects
     * which component implementation `Mermaid.vue` delegates to at runtime.
     */
    renderer?: string
    /**
     * Spinner component name to use while Mermaid is loading.
     * This should be a globally available component name (e.g., under the project `components/` directory).
     * If not provided, the module's built-in `Spinner.vue` will be used.
     */
    spinner?: string
    /**
     * Error component name to display when Mermaid rendering fails.
     * This should be a globally available component name (e.g., under the project `components/` directory).
     * If not provided, the module's built-in fallback message will be used.
     */
    error?: string
  }
  /**
   * Options related to SVG expand (lightbox) interactions
   */
  /**
   * Expand configuration. `false` disables expand, `true` uses defaults.
   */
  expand?: ExpandOptions | boolean
  /**
   * Default toolbar settings for Mermaid component
   */
  toolbar?: MermaidToolbarOptions
}

const DEFAULTS = {
  enabled: true,
  loader: {
    init: { ...DEFAULT_MERMAID_CONFIG },
    lazy: true,
  },
  theme: {
    light: DEFAULT_LIGHT_THEME,
    dark: DEFAULT_DARK_THEME,
  },
  components: {
    renderer: undefined,
    spinner: undefined,
    error: undefined,
  },
  expand: DEFAULT_EXPAND_OPTIONS,
  toolbar: DEFAULT_TOOLBAR_OPTIONS,
} satisfies ModuleOptions

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@barzhsieh/nuxt-content-mermaid',
    configKey: 'contentMermaid',
    compatibility: {
      nuxt: '^3.20.1 || ^4.1.0',
    },
  },
  defaults: {
    ...DEFAULTS,
  },
  setup(options, nuxt) {
    const logger = useLogger('nuxt-content-mermaid')
    const warn = (message: string) => logger.warn(message)

    const deprecatedOptions = (nuxt.options as { mermaidContent?: ModuleOptions }).mermaidContent
    const hasDeprecatedOptions = deprecatedOptions
      && typeof deprecatedOptions === 'object'
      && Object.keys(deprecatedOptions).length > 0

    if (hasDeprecatedOptions)
      warn('[nuxt-content-mermaid] `mermaidContent` is deprecated, please switch to `contentMermaid`. The old key is still read for now but will be removed in a future release.')

    const resolvedOptions = defu(
      {},
      options,
      deprecatedOptions,
      DEFAULTS,
    ) as ModuleOptions

    const resolver = createResolver(import.meta.url)
    const runtimeDir = resolver.resolve('./runtime')

    nuxt.options.css ||= []
    nuxt.options.css.push(resolver.resolve('./runtime/styles.css'))

    const publicRuntimeConfig = nuxt.options.runtimeConfig.public
    const runtimeOverrides = (publicRuntimeConfig.contentMermaid
      || publicRuntimeConfig.mermaidContent
      || {}) as Partial<ModuleOptions>

    if (!publicRuntimeConfig.contentMermaid && publicRuntimeConfig.mermaidContent)
      warn('[nuxt-content-mermaid] `runtimeConfig.public.mermaidContent` is deprecated, please use `runtimeConfig.public.contentMermaid` instead.')

    const runtimeMermaidConfig = defu(
      {},
      runtimeOverrides,
      resolvedOptions,
    ) as ModuleOptions

    publicRuntimeConfig.contentMermaid
      = runtimeMermaidConfig as typeof publicRuntimeConfig.contentMermaid
    publicRuntimeConfig.mermaidContent
      = runtimeMermaidConfig as typeof publicRuntimeConfig.mermaidContent

    // Transform Markdown output to use fixed <Mermaid>, delegated by runtime components.renderer
    const baseMermaidComponentName = 'Mermaid'

    const isEnabled = runtimeMermaidConfig.enabled !== false
    if (!isEnabled) return

    // Ensure Vite pre-bundles sanitize-url so named exports work when mermaid lazily imports it in dev
    addVitePlugin(() => ({
      name: 'nuxt-content-mermaid:optimize-deps',
      configEnvironment(name, config) {
        if (name === 'client') {
          config.optimizeDeps ||= {}
          config.optimizeDeps.include ||= []
          config.optimizeDeps.include.push(SANITIZE_URL_PACKAGE)
        }
      },
    }))

    // Inject client plugin
    addPlugin({
      src: resolver.resolve(runtimeDir, 'plugins/mermaid.client'),
      mode: 'client',
    })

    // Register built-in Mermaid wrapper, can be overridden at runtime
    addComponent({
      name: baseMermaidComponentName,
      filePath: resolver.resolve(runtimeDir, 'components/Mermaid.vue'),
    })

    // Auto-import composable for manual theme control
    addImports([
      {
        name: 'useMermaidTheme',
        as: 'useMermaidTheme',
        from: resolver.resolve(runtimeDir, 'composables/useMermaidTheme'),
      },
    ])

    // Add type definitions
    addTypeTemplate({
      filename: 'types/mermaid-content.d.ts',
      getContents: () => `
import type { Mermaid } from 'mermaid'

declare module '#app' {
  interface NuxtApp {
    $mermaid: () => Promise<Mermaid>
  }
}
declare module 'vue' {
  interface ComponentCustomProperties {
    $mermaid: () => Promise<Mermaid>
  }
}
export {}
`,
    })

    // Transform mermaid fenced code blocks in Markdown
    nuxt.hook('content:file:beforeParse', (ctx: FileBeforeParseHook) => {
      const { file } = ctx

      if (!file.id?.endsWith('.md')) return
      if (!MERMAID_FENCE_RE.test(file.body)) return

      file.body = transformMermaidCodeBlocks(
        file.body,
        baseMermaidComponentName,
      )
    })
  },
})

export function transformMermaidCodeBlocks(
  body: string,
  componentName: string,
  frontmatterConfigKey: string = DEFAULT_FRONTMATTER_CONFIG_KEY,
) {
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  const lines = body.split(newline)
  const output: string[] = []

  // Track whether we're currently inside a fenced code block that is NOT a top-level mermaid fence.
  let inFence = false
  let fenceChar: '`' | '~' | null = null
  let fenceLength = 0

  const isClosingFence = (line: string) => {
    if (!fenceChar) return false
    const trimmed = line.trim()
    if (trimmed.length < fenceLength) return false
    for (const char of trimmed) {
      if (char !== fenceChar) return false
    }
    return true
  }

  const isFenceMarkerChar = (char: string | undefined): char is '`' | '~' =>
    char === '`' || char === '~'

  const parseFence = (line: string) => {
    let index = 0
    while (index < line.length && (line[index] === ' ' || line[index] === '\t'))
      index++

    const indent = line.slice(0, index)
    const markerChar = line[index]
    if (!isFenceMarkerChar(markerChar))
      return null

    let markerEnd = index
    while (markerEnd < line.length && line[markerEnd] === markerChar)
      markerEnd++

    const markerLength = markerEnd - index
    if (markerLength < 3)
      return null

    return {
      indent,
      markerChar,
      markerLength,
      info: line.slice(markerEnd).trim(),
    }
  }

  const isMermaidFence = (info: string) => {
    // Accept "mermaid" as the fence info string and allow common MDC/MD meta:
    // e.g. "mermaid", "mermaid {..}", "mermaid [..]".
    if (!info) return false
    const lower = info.toLowerCase()
    if (!lower.startsWith('mermaid')) return false

    const next = lower.slice('mermaid'.length, 'mermaid'.length + 1)
    return next === '' || /\s/.test(next) || next === '{' || next === '['
  }

  const buildComponentTag = (encoded: string, toolbar?: MermaidToolbarOptions) => {
    const attrs = [
      `:config="${frontmatterConfigKey}"`,
    ]

    if (toolbar && isNonEmptyRecord(toolbar)) {
      attrs.push(`:toolbar='${stringifyInlineValue(toolbar)}'`)
    }

    attrs.push(`code="${encoded}"`)
    return `<${componentName} ${attrs.join(' ')}></${componentName}>`
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!

    if (inFence) {
      output.push(line)
      if (isClosingFence(line)) {
        inFence = false
        fenceChar = null
        fenceLength = 0
      }
      continue
    }

    const fence = parseFence(line)
    if (!fence) {
      output.push(line)
      continue
    }

    // Only transform top-level mermaid fences; treat other fenced code blocks as opaque.
    if (!isMermaidFence(fence.info)) {
      // Enter an opaque fence: everything is emitted as-is until its closing fence.
      inFence = true
      fenceChar = fence.markerChar
      fenceLength = fence.markerLength
      output.push(line)
      continue
    }

    // Find the matching closing fence (same char, at least same length).
    let closingIndex = -1
    for (let j = index + 1; j < lines.length; j++) {
      const trimmed = lines[j]!.trim()
      if (trimmed.length < fence.markerLength) continue
      let isFence = true
      for (const char of trimmed) {
        if (char !== fence.markerChar) {
          isFence = false
          break
        }
      }
      if (isFence) {
        closingIndex = j
        break
      }
    }

    // If the fence is unclosed, leave it untouched.
    if (closingIndex === -1) {
      output.push(line)
      continue
    }

    const rawCode = lines.slice(index + 1, closingIndex).join(newline)
    const code = rawCode.trim()

    if (!code) {
      output.push(...lines.slice(index, closingIndex + 1))
      index = closingIndex
      continue
    }

    const inlineAttrs = parseInlineAttrs(fence.info)
    const frontmatterInfo = parseMermaidFrontmatter(rawCode, newline)
    const inlineOverrides = extractMermaidInlineOverrides(inlineAttrs)
    const mergedCode = inlineOverrides
      ? applyMermaidFrontmatterOverrides(rawCode, newline, frontmatterInfo, inlineOverrides, fence.indent)
      : rawCode

    const toolbarProps = mergeToolbarProps(
      extractToolbarProps(frontmatterInfo?.data),
      extractToolbarProps(inlineAttrs),
    )

    const encoded = encodeURIComponent(mergedCode.trim())
    output.push(`${fence.indent}${buildComponentTag(encoded, toolbarProps)}`)
    index = closingIndex
  }

  return output.join(newline)
}
