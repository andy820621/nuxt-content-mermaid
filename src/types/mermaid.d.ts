import type { DefineComponent } from 'vue'
import type { Mermaid, MermaidConfig } from 'mermaid'
import type { ModuleOptions } from '../module'
import type { MermaidThemeMode, SimpleMermaidTheme } from '../runtime/composables/useMermaidTheme'

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
    contentMermaid?: ModuleOptions
    /**
     * @deprecated Use `contentMermaid`
     */
    mermaidContent?: ModuleOptions
  }

  interface NuxtOptions {
    contentMermaid?: ModuleOptions
    /**
     * @deprecated Use `contentMermaid`
     */
    mermaidContent?: ModuleOptions
  }

  interface PublicRuntimeConfig {
    contentMermaid?: Partial<ModuleOptions>
    /**
     * @deprecated Use `contentMermaid`
     */
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

export type { MermaidThemeMode, SimpleMermaidTheme }
export {}
