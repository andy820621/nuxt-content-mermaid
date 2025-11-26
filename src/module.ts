import {
  defineNuxtModule,
  createResolver,
  addPlugin,
  addComponent,
  addTypeTemplate,
} from '@nuxt/kit'
import { defu } from 'defu'
import type { FileBeforeParseHook } from '@nuxt/content'
import type { MermaidConfig } from 'mermaid'
import {
  DEFAULT_DARK_THEME,
  DEFAULT_IMPORT_SOURCE,
  DEFAULT_LIGHT_THEME,
  DEFAULT_MERMAID_INIT,
} from './runtime/constants'

const MERMAID_BLOCK = /```mermaid([\s\S]*?)```/gi

export interface ModuleOptions {
  /**
   * Whether to enable the entire Mermaid process
   * @default true
   */
  enabled?: boolean
  /**
   * Options related to loading mermaid
   */
  loader?: {
    /**
     * Mermaid ESM source, can be a CDN URL or local /public path
     */
    importSource?: string
    /**
     * Pass-through to `mermaid.initialize`
     */
    init?: MermaidConfig
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
  }
}

const DEFAULTS = {
  enabled: true,
  loader: {
    importSource: DEFAULT_IMPORT_SOURCE,
    init: { ...DEFAULT_MERMAID_INIT },
  },
  theme: {
    useColorModeTheme: true,
    light: DEFAULT_LIGHT_THEME,
    dark: DEFAULT_DARK_THEME,
  },
  components: {
    renderer: undefined,
    spinner: undefined,
  },
} satisfies ModuleOptions

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@barzhsieh/nuxt-content-mermaid',
    configKey: 'mermaidContent',
    compatibility: {
      nuxt: '^4.0.0',
    },
  },
  defaults: {
    ...DEFAULTS,
  },
  setup(options, nuxt) {
    const resolvedOptions = defu(options, DEFAULTS)

    const resolver = createResolver(import.meta.url)
    const runtimeDir = resolver.resolve('./runtime')

    const publicRuntimeConfig = nuxt.options.runtimeConfig.public
    const runtimeOverrides = (publicRuntimeConfig.mermaidContent
      || {}) as Partial<ModuleOptions>

    const runtimeMermaidConfig = defu(
      runtimeOverrides,
      resolvedOptions,
    ) as ModuleOptions

    publicRuntimeConfig.mermaidContent
      = runtimeMermaidConfig as typeof publicRuntimeConfig.mermaidContent

    // Transform Markdown output to use fixed <Mermaid>, delegated by runtime components.renderer
    const baseMermaidComponentName = 'Mermaid'

    const isEnabled = runtimeMermaidConfig.enabled !== false
    if (!isEnabled) return

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

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function transformMermaidCodeBlocks(body: string, componentName: string) {
  return body.replace(MERMAID_BLOCK, (_, rawCode = '') => {
    const code = rawCode.trim()
    if (!code) return _
    const escaped = escapeHtml(code)

    return `<${componentName}>
<pre><code>${escaped}
</code></pre>
</${componentName}>`
  })
}
