import { defineNuxtPlugin } from '#app'
import ContentMermaidTransport from '../components/ContentMermaidTransport.vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('ContentMermaidTransport', ContentMermaidTransport)
})
