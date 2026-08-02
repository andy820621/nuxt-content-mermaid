import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, createTestContext, loadFixture, setup } from '@nuxt/test-utils/e2e'

describe('disabled module configuration fixture', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/module-configuration-disabled', import.meta.url)),
  })

  it('does not publish runtime transport when activation is disabled', async () => {
    const html = await $fetch('/')
    expect(html).toContain('data-content-mermaid-present="false"')
  })
})

describe('legacy module configuration fixture', () => {
  it('fails with the public migration fingerprint', async () => {
    createTestContext({
      rootDir: fileURLToPath(new URL('./fixtures/module-configuration-legacy', import.meta.url)),
      browser: false,
      build: true,
      server: false,
    })

    await expect(loadFixture()).rejects.toThrowError(expect.objectContaining({
      name: 'ContentMermaidConfigurationError',
      code: 'CONTENT_MERMAID_CONFIGURATION_ERROR',
    }))
  })
})
