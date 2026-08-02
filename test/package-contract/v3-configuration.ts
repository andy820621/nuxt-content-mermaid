import type { NuxtConfig } from '@nuxt/schema'
import type {
  MermaidComponentProps,
  ModuleOptions,
  RuntimeMermaidConfig,
  RuntimeOptions,
} from '../../src/module'

const runtimeConfig = {
  debug: true,
  loader: {
    init: {
      theme: 'dark',
      unknownMermaidExtension: { enabled: false, values: [null, 1, 'kept'] },
    },
  },
} satisfies RuntimeOptions

const moduleConfig = {
  enabled: false,
  ...runtimeConfig,
} satisfies ModuleOptions

const pageProps = {
  pageConfig: { theme: 'forest' },
  code: 'graph TD; A-->B',
} satisfies MermaidComponentProps

const directProps = {
  config: { sequence: { actorFont: () => ({ fontSize: 14 }) } },
} satisfies MermaidComponentProps

// @ts-expect-error runtime transport cannot contain functions
const invalidRuntimeFunction: RuntimeMermaidConfig = { sequence: { actorFont: () => ({}) } }

// @ts-expect-error recursively nested runtime values must remain pure data
const invalidNestedRuntimeFunction: RuntimeMermaidConfig = { unknownMermaidExtension: { load: () => ({}) } }

// @ts-expect-error runtime transport cannot contain arbitrary class instances
const invalidRuntimeInstance: RuntimeMermaidConfig = { unknownMermaidExtension: new Date() }

// @ts-expect-error Mermaid's unbounded `any` field is not part of the runtime transport contract
const invalidRuntimeAny: RuntimeMermaidConfig = { themeVariables: {} }

// @ts-expect-error build activation is not a runtime option
const invalidRuntimeEnabled: RuntimeOptions = { enabled: false }

// @ts-expect-error page configuration is pure data
const invalidPageProps: MermaidComponentProps = { pageConfig: { sequence: { actorFont: () => ({}) } } }

// @ts-expect-error configuration source props are mutually exclusive
const invalidComponentProps: MermaidComponentProps = { pageConfig: {}, config: {} }

declare const nuxtConfig: NuxtConfig

// @ts-expect-error 3.0 removes the legacy Nuxt configuration alias
void nuxtConfig.mermaidContent

void [
  moduleConfig,
  pageProps,
  directProps,
  invalidRuntimeFunction,
  invalidNestedRuntimeFunction,
  invalidRuntimeInstance,
  invalidRuntimeAny,
  invalidRuntimeEnabled,
  invalidPageProps,
  invalidComponentProps,
]
