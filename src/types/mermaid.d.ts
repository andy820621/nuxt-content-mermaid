import type { Mermaid, MermaidConfig } from 'mermaid'

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
    mermaidContent?: {
      enabled?: boolean
      importSource?: string
      init?: MermaidConfig
      followColorMode?: boolean
      lightTheme?: MermaidConfig['theme']
      darkTheme?: MermaidConfig['theme']
      mermaidComponent?: string
      spinnerComponent?: string
    }
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
