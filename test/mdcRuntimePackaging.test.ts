import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const mdcPackageRoot = resolve(dirname(require.resolve('@nuxtjs/mdc')), '..')

describe('@nuxtjs/mdc package', () => {
  it('includes the runtime Vue components registered by Nuxt Content', () => {
    const requiredComponents = [
      'MDC.vue',
      'MDCCached.vue',
      'MDCRenderer.vue',
      'MDCSlot.vue',
    ]
    const missingComponents = requiredComponents.filter(component =>
      !existsSync(resolve(mdcPackageRoot, 'dist/runtime/components', component)),
    )

    expect(missingComponents).toEqual([])
  })
})
