import type { DefineComponent } from 'vue'
import type { Mermaid } from 'mermaid'
import type { MermaidComponentProps, ModuleOptions, RuntimeOptions } from './config'
import type { MermaidThemeMode, SimpleMermaidTheme } from '../runtime/composables/useMermaidTheme'

export type MermaidToolbarButtons = {
  copy?: boolean
  fullscreen?: boolean
  expand?: boolean
}

export type MermaidToolbarOptions = {
  title?: string
  fontSize?: string | number
  fullscreenToolbarScale?: number
  buttons?: MermaidToolbarButtons
}

declare module '#app' {
  interface NuxtApp {
    $mermaid: () => Promise<Mermaid>
  }
}
declare module 'vue' {
  interface ComponentCustomProperties {
    $mermaid: () => Promise<Mermaid>
  }
  interface GlobalComponents {
    Mermaid: DefineComponent<MermaidComponentProps>
  }
}

declare module '@nuxt/schema' {
  interface NuxtConfig {
    contentMermaid?: ModuleOptions
  }

  interface NuxtOptions {
    contentMermaid?: ModuleOptions
  }

  interface PublicRuntimeConfig {
    contentMermaid?: RuntimeOptions
  }
}

declare global {
  interface ImportMeta {
    glob<T = unknown>(
      pattern: string,
      options?: {
        eager?: boolean
        import?: string
      },
    ): Record<string, () => Promise<T>>
  }
}

export type { MermaidThemeMode, SimpleMermaidTheme }
export {}
