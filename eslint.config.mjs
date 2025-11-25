// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // Rules for formatting
    stylistic: true,
  },
  dirs: {
    src: ['./playground'],
  },
}).append({
  rules: {
    // Allow single-word component names "Mermaid" and Nuxt dynamic route component "[...slug]"
    'vue/multi-word-component-names': [
      'error',
      { ignores: ['Mermaid', 'Spinner', '[...slug]'] },
    ],
  },
})
