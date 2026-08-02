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
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_MERMAID_CONFIG,
  DEFAULT_TOOLBAR_OPTIONS,
  DEFAULT_EXPAND_OPTIONS,
} from './runtime/constants'
import { transformMarkdownDiagrams } from './markdown-diagram-transform'
import type { ModuleOptions, RuntimeMermaidConfig } from './types/config'

export type {
  MermaidComponentProps,
  ModuleOptions,
  PageMermaidConfig,
  RuntimeMermaidConfig,
  RuntimeOptions,
} from './types/config'

const MODULE_NAME = '@barzhsieh/nuxt-content-mermaid'

/**
 * CJS packages that mermaid externally imports in its ESM chunks (`mermaid.core.mjs`).
 * Vite must pre-bundle these so CJS → ESM interop works in the dev server.
 *
 * `dayjs` is CJS-only (UMD, no `type`/`module`/`exports` fields in its package.json).
 * `@braintree/sanitize-url` is another CJS external of mermaid.
 * mermaid's Gantt-diagram chunk additionally imports several dayjs plugins.
 *
 * Under pnpm strict mode, these packages are NOT hoisted to the consumer project's
 * `node_modules/`. Vite's `optimizeDeps.include` requires bare specifiers to be
 * resolvable from the project root. We use the Vite nested-dependency syntax
 * (`parent > child`) so Vite resolves them via this module's own node_modules.
 */
const MERMAID_OPTIMIZE_DEPS = [
  'mermaid',
  '@braintree/sanitize-url',
  'dayjs',
  'dayjs/plugin/isoWeek.js',
  'dayjs/plugin/customParseFormat.js',
  'dayjs/plugin/advancedFormat.js',
  'dayjs/plugin/duration.js',
]

const DEFAULTS = {
  enabled: true,
  loader: {
    init: { ...DEFAULT_MERMAID_CONFIG } as RuntimeMermaidConfig,
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
    name: MODULE_NAME,
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

    // Ensure Vite pre-bundles mermaid and its CJS dependencies so ESM interop works in dev.
    // mermaid's ESM build (`mermaid.core.mjs`) externalizes CJS deps like `dayjs` and
    // `@braintree/sanitize-url`. Without pre-bundling, Vite serves the raw CJS files via /@fs/
    // and the browser cannot resolve default/named imports from CJS modules.
    //
    // Under pnpm strict mode these are not hoisted, so we use nested-dependency syntax
    // (`<this-module> > <dep>`) to let Vite resolve through our own node_modules.
    addVitePlugin(() => ({
      name: 'nuxt-content-mermaid:optimize-deps',
      configEnvironment(name, config) {
        if (name === 'client') {
          config.optimizeDeps ||= {}
          config.optimizeDeps.include ||= []
          config.optimizeDeps.include.push(
            ...MERMAID_OPTIMIZE_DEPS.map(dep => `${MODULE_NAME} > ${dep}`),
          )
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

      file.body = transformMarkdownDiagrams(file.body)
    })
  },
})
