import { defineNuxtPlugin } from '#app'
import type { Mermaid, MermaidConfig } from 'mermaid'
import { materializeMermaidConfigForInvocation } from '../mermaid-config'
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
        const initOptions = materializeMermaidConfigForInvocation({
          runtimeConfig: (snapshot.loader?.init ?? {}) as MermaidConfig,
          source: { kind: 'runtime-only' },
        })
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
