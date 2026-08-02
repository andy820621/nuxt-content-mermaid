import { defineNuxtPlugin } from '#app'
import type { Mermaid, MermaidConfig } from 'mermaid'
import { cloneOwnedData } from '../../configuration/core'
import type { JsonObject } from '../../types/config'
import { getRuntimeMermaidSnapshot } from '../runtime-snapshot'

export default defineNuxtPlugin((nuxtApp) => {
  const snapshot = getRuntimeMermaidSnapshot(nuxtApp)
  let mermaidLoader: Promise<Mermaid> | undefined

  const loadMermaid = async (): Promise<Mermaid> => {
    if (mermaidLoader) return mermaidLoader

    mermaidLoader = (async () => {
      try {
        const mermaid = await import('mermaid')
        const mermaidInstance = (mermaid.default ?? mermaid) as Mermaid
        const initOptions = cloneOwnedData(
          (snapshot.loader?.init ?? {}) as unknown as JsonObject,
        ) as MermaidConfig
        mermaidInstance.initialize(initOptions)
        return mermaidInstance
      }
      catch (error) {
        mermaidLoader = undefined
        throw error
      }
    })()

    return mermaidLoader
  }

  return {
    provide: {
      mermaid: () => loadMermaid(),
    },
  }
})
