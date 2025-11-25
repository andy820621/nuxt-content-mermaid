import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import type { Mermaid, MermaidConfig } from 'mermaid'

interface MermaidRuntimeConfig {
  enabled?: boolean
  importSource?: string
  init?: MermaidConfig
}

const DEFAULT_SOURCE
  = 'https://cdn.jsdelivr.net/npm/mermaid@11.12.1/dist/mermaid.esm.min.mjs'

declare global {
  var __nuxtMermaidLoader__: Promise<Mermaid> | undefined
}

const globalWithLoader = globalThis as typeof globalThis & {
  __nuxtMermaidLoader__?: Promise<Mermaid>
}

const ABSOLUTE_URL_REGEX = /^(?:https?:)?\/\//

function resolveSource(source: string) {
  if (ABSOLUTE_URL_REGEX.test(source)) return source
  if (source.startsWith('/')) return source
  if (typeof window !== 'undefined')
    return new URL(source, window.location.origin).href
  return source
}

async function loadMermaidFrom(source: string): Promise<Mermaid> {
  const mod = await import(/* @vite-ignore */ resolveSource(source))
  return (mod.default ?? mod) as Mermaid
}

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const mermaidConfig = runtimeConfig.public?.mermaidContent as
    | MermaidRuntimeConfig
    | undefined

  if (mermaidConfig?.enabled === false) {
    return {
      provide: {
        mermaid: async () => {
          throw new Error(
            '[nuxt-mermaid-content] Mermaid is disabled via config.',
          )
        },
      },
    }
  }

  const loadMermaid = async (): Promise<Mermaid> => {
    if (globalWithLoader.__nuxtMermaidLoader__)
      return globalWithLoader.__nuxtMermaidLoader__

    const importSource = mermaidConfig?.importSource || DEFAULT_SOURCE
    const initOptions: MermaidConfig = {
      startOnLoad: false,
      ...mermaidConfig?.init,
    }

    globalWithLoader.__nuxtMermaidLoader__ = loadMermaidFrom(importSource)
      .then((mermaid) => {
        mermaid.initialize(initOptions)
        return mermaid
      })
      .catch((error) => {
        globalWithLoader.__nuxtMermaidLoader__ = undefined
        throw error
      })

    return globalWithLoader.__nuxtMermaidLoader__
  }

  return {
    provide: {
      mermaid: () => loadMermaid(),
    },
  }
})
