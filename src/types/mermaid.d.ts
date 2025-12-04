import type { DefineComponent } from 'vue'
import type { Mermaid, MermaidConfig } from 'mermaid'
import type { ModuleOptions } from '../module'

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
    Mermaid: DefineComponent<{
      config?: MermaidConfig
    }>
  }
}

declare module 'nuxt/schema' {
  interface NuxtConfig {
    mermaidContent?: ModuleOptions
  }

  interface NuxtOptions {
    mermaidContent?: ModuleOptions
  }

  interface PublicRuntimeConfig {
    mermaidContent?: Partial<ModuleOptions>
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
export {}
