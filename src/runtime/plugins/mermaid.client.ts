import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import type { Mermaid, MermaidConfig } from 'mermaid'
import type { ModuleOptions } from '../../module'
import { DEFAULT_MERMAID_CONFIG } from '../constants'

declare global {
  var __nuxtMermaidLoader__: Promise<Mermaid> | undefined
}

const globalWithLoader = globalThis as typeof globalThis & {
  __nuxtMermaidLoader__?: Promise<Mermaid>
}

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const mermaidConfig = (runtimeConfig.public?.contentMermaid
    ?? runtimeConfig.public?.mermaidContent
    ?? {}) as ModuleOptions

  if (mermaidConfig?.enabled === false) {
    return {
      provide: {
        mermaid: async () => {
          throw new Error(
            '[nuxt-content-mermaid] Mermaid is disabled via config.',
          )
        },
      },
    }
  }

  const loadMermaid = async (): Promise<Mermaid> => {
    if (globalWithLoader.__nuxtMermaidLoader__)
      return globalWithLoader.__nuxtMermaidLoader__

    const initOptions: MermaidConfig = {
      ...DEFAULT_MERMAID_CONFIG,
      ...mermaidConfig?.loader?.init,
    }

    globalWithLoader.__nuxtMermaidLoader__ = (async () => {
      try {
        const mermaid = await import('mermaid')
        const mermaidInstance = (mermaid.default ?? mermaid) as Mermaid
        mermaidInstance.initialize(initOptions)
        return mermaidInstance
      }
      catch (error) {
        globalWithLoader.__nuxtMermaidLoader__ = undefined
        throw error
      }
    })()

    return globalWithLoader.__nuxtMermaidLoader__
  }

  return {
    provide: {
      mermaid: () => loadMermaid(),
    },
  }
})
