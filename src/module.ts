import {
  defineNuxtModule,
  createResolver,
  addPlugin,
  addComponent,
  addTypeTemplate,
  addVitePlugin,
  useLogger,
} from '@nuxt/kit'
import { defu } from 'defu'
import type { FileBeforeParseHook } from '@nuxt/content'
import type { MermaidConfig } from 'mermaid'
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_MERMAID_CONFIG,
  DEFAULT_FRONTMATTER_CONFIG_KEY,
} from './runtime/constants'

const MERMAID_BLOCK = /```mermaid([\s\S]*?)```/gi
const SANITIZE_URL_PACKAGE = '@braintree/sanitize-url'

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
     * Whether to sync Mermaid theme with @nuxtjs/color-mode
     * @default true
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
}

const DEFAULTS = {
  enabled: true,
  loader: {
    init: { ...DEFAULT_MERMAID_CONFIG },
    lazy: true,
  },
  theme: {
    useColorModeTheme: true,
    light: DEFAULT_LIGHT_THEME,
    dark: DEFAULT_DARK_THEME,
  },
  components: {
    renderer: undefined,
    spinner: undefined,
    error: undefined,
  },
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

    // Transform ```mermaid code blocks in Markdown
    nuxt.hook('content:file:beforeParse', (ctx: FileBeforeParseHook) => {
      const { file } = ctx

      if (!file.id?.endsWith('.md')) return
      if (!file.body.toLowerCase().includes('```mermaid')) return

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
  return body.replace(MERMAID_BLOCK, (_, rawCode = '') => {
    const code = rawCode.trim()
    if (!code) return _
    const encoded = encodeURIComponent(code)

    return `<${componentName} :config="${frontmatterConfigKey}" code="${encoded}"></${componentName}>`
  })
}
