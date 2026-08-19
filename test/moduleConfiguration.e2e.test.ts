import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

describe('module configuration fixture', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/module-configuration', import.meta.url)),
  })

  it('publishes the canonical runtime transport after applying fixed precedence', async () => {
    const html = await $fetch('/')

    expect(html).toContain('runtime-title')
    expect(html).toContain('runtime-copy-label')
    expect(html).toContain('nuxt-reset-label')
    expect(html).toContain('runtime-mermaid-extension')
    expect(html).toContain('data-has-module-activation="false"')
    expect(html).toContain('data-expand-enabled="false"')
  })
})
