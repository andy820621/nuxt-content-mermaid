import { defineNuxtPlugin, useRuntimeConfig } from '#app'
import { installRuntimeMermaidSnapshot } from '../runtime-snapshot'

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig()
  installRuntimeMermaidSnapshot(
    nuxtApp,
    runtimeConfig.public?.contentMermaid,
  )
})
