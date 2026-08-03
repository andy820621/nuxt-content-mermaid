import { defineNuxtPlugin } from '#app'

declare global {
  interface Window {
    __customRendererErrors__?: string[]
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error) => {
    window.__customRendererErrors__ ??= []
    window.__customRendererErrors__.push(error instanceof Error ? error.message : String(error))
  }
})
