import type { Mermaid } from 'mermaid'
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
}

declare module 'nuxt/schema' {
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
