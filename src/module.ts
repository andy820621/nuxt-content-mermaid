import {
  defineNuxtModule,
  createResolver,
  addPlugin,
  addComponent,
  addTypeTemplate,
  addVitePlugin,
  addImports,
} from '@nuxt/kit'
import type { FileBeforeParseHook } from '@nuxt/content'
import { ContentMermaidConfigurationError } from './runtime/configuration/core'
import { resolveModuleConfiguration } from './runtime/configuration/module'
import { transformMarkdownDiagrams } from './markdown-diagram-transform'
import type { ModuleOptions } from './types/config'

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

const LEGACY_ALIAS_PHASE = {
  name: 'Nuxt Module Configuration',
  root: 'nuxt.options',
} as const

function throwMigrationError(path: readonly string[], expected: string, received: string): never {
  throw new ContentMermaidConfigurationError(LEGACY_ALIAS_PHASE, [{
    path,
    code: 'UNEXPECTED_PROPERTY',
    expected,
    received,
  }], false)
}

function assertNoLegacyModuleAlias(nuxtOptions: object): void {
  if (Object.getOwnPropertyDescriptor(nuxtOptions, 'mermaidContent')) {
    throwMigrationError(['mermaidContent'], 'the supported contentMermaid key', 'removed legacy alias')
  }
}

function readRuntimeOverrides(publicRuntimeConfig: object): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(publicRuntimeConfig, 'contentMermaid')
  if (!descriptor) return undefined
  if (!('value' in descriptor)) {
    throwMigrationError(
      ['runtimeConfig', 'public', 'contentMermaid'],
      'an enumerable data property',
      'accessor',
    )
  }
  if (!descriptor.enumerable) {
    throwMigrationError(
      ['runtimeConfig', 'public', 'contentMermaid'],
      'an enumerable data property',
      'non-enumerable-property',
    )
  }
  return descriptor.value
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: MODULE_NAME,
    configKey: 'contentMermaid',
    compatibility: {
      nuxt: '^3.20.1 || ^4.1.0',
    },
  },
  setup(options, nuxt) {
    assertNoLegacyModuleAlias(nuxt.options)
    const publicRuntimeConfig = nuxt.options.runtimeConfig.public
    const resolved = resolveModuleConfiguration({
      nuxtResolvedOptions: options,
      runtimeOverrides: readRuntimeOverrides(publicRuntimeConfig),
    })
    if (!resolved.enabled) return

    publicRuntimeConfig.contentMermaid
      = resolved.runtimeOptions as typeof publicRuntimeConfig.contentMermaid

    const resolver = createResolver(import.meta.url)
    const runtimeDir = resolver.resolve('./runtime')
    const baseMermaidComponentName = 'Mermaid'

    nuxt.options.css ||= []
    nuxt.options.css.push(resolver.resolve('./runtime/styles.css'))

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

    // Nuxt Kit prepends plugins, so register the loader first to place the
    // Universal Runtime Adapter ahead of it in the final plugin array.
    addPlugin({
      src: resolver.resolve(runtimeDir, 'plugins/mermaid.client'),
      mode: 'client',
    })
    addPlugin({
      src: resolver.resolve(runtimeDir, 'plugins/runtime-config'),
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
    // @nuxt/content augments this hook only in consuming applications.
    nuxt.hook('content:file:beforeParse' as never, ((ctx: FileBeforeParseHook) => {
      const { file } = ctx

      if (!file.id?.endsWith('.md')) return

      file.body = transformMarkdownDiagrams(file.body)
    }) as never)
  },
})
