import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MyModule],
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
  },
})
