import { describe, expect, it } from 'vitest'

describe('website Reference semantic rendering helpers', () => {
  it('formats validated literal and conditional values as readable code', async () => {
    const { formatReferenceValue } = await import('../website/utils/reference-format')

    expect(formatReferenceValue({
      startOnLoad: false,
      theme: 'default',
      fontFamily: 'Arial, sans-serif, 微軟正黑體',
      securityLevel: 'strict',
    })).toBe('{ startOnLoad: false, theme: \'default\', fontFamily: \'Arial, sans-serif, 微軟正黑體\', securityLevel: \'strict\' }')
    expect(formatReferenceValue({ logLevel: 5, suppressErrorRendering: true }))
      .toBe('{ logLevel: 5, suppressErrorRendering: true }')
    expect(formatReferenceValue({ logLevel: 1, suppressErrorRendering: false }))
      .toBe('{ logLevel: 1, suppressErrorRendering: false }')
  })
})
