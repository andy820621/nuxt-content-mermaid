import type { NuxtConfig, PublicRuntimeConfig } from '@nuxt/schema'
import type {
  MermaidComponentProps,
  ModuleOptions,
  RuntimeMermaidConfig,
  RuntimeOptions,
} from '@barzhsieh/nuxt-content-mermaid'

type IsUnknown<T> = unknown extends T
  ? keyof T extends never ? true : false
  : false
type Expect<T extends true> = T

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

const publicRuntimeConfig = {
  contentMermaid: runtimeConfig,
} satisfies PublicRuntimeConfig

const pageProps = {
  pageConfig: { theme: 'forest' },
  code: 'graph TD; A-->B',
} satisfies MermaidComponentProps

const directProps = {
  config: { sequence: { actorFont: () => ({ fontSize: 14 }) } },
  toolbar: {
    labels: {
      copy: '',
      resetZoom: 'Reset diagram view',
    },
  },
} satisfies MermaidComponentProps

// @ts-expect-error runtime transport cannot contain functions
const invalidRuntimeFunction: RuntimeMermaidConfig = { sequence: { actorFont: () => ({}) } }

// @ts-expect-error recursively nested runtime values must remain pure data
const invalidNestedRuntimeFunction: RuntimeMermaidConfig = { unknownMermaidExtension: { load: () => ({}) } }

// @ts-expect-error runtime transport cannot contain arbitrary class instances
const invalidRuntimeInstance: RuntimeMermaidConfig = { unknownMermaidExtension: new Date() }

// @ts-expect-error runtime transport cannot contain explicit undefined values
const invalidRuntimeUndefined: RuntimeMermaidConfig = { unknownMermaidExtension: undefined }

// @ts-expect-error Mermaid's unbounded `any` field is not part of the runtime transport contract
const invalidRuntimeAny: RuntimeMermaidConfig = { themeVariables: {} }

// @ts-expect-error build activation is not a runtime option
const invalidRuntimeEnabled: RuntimeOptions = { enabled: false }

// @ts-expect-error page configuration is pure data
const invalidPageProps: MermaidComponentProps = { pageConfig: { sequence: { actorFont: () => ({}) } } }

// @ts-expect-error configuration source props are mutually exclusive
const invalidComponentProps: MermaidComponentProps = { pageConfig: {}, config: {} }

// @ts-expect-error application-level null remains invalid outside the Markdown transport
const invalidNullPageProps: MermaidComponentProps = { pageConfig: null }

declare const nuxtConfig: NuxtConfig
declare const resolvedPublicRuntimeConfig: PublicRuntimeConfig

// @ts-expect-error 3.0 removes the legacy Nuxt configuration alias
void nuxtConfig.mermaidContent

// @ts-expect-error module activation is absent from public runtime configuration
void resolvedPublicRuntimeConfig.contentMermaid?.enabled

type LegacyPublicRuntimeAliasIsUnclaimed = Expect<
  IsUnknown<PublicRuntimeConfig['mermaidContent']>
>

void [
  moduleConfig,
  publicRuntimeConfig,
  pageProps,
  directProps,
  invalidRuntimeFunction,
  invalidNestedRuntimeFunction,
  invalidRuntimeInstance,
  invalidRuntimeUndefined,
  invalidRuntimeAny,
  invalidRuntimeEnabled,
  invalidPageProps,
  invalidComponentProps,
  invalidNullPageProps,
]

export type { LegacyPublicRuntimeAliasIsUnclaimed }
