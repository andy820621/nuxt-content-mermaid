import { describe, expect, it } from 'vitest'
import {
  hasOnlySafeSvgCssReferences,
  isSafeSvgUrlReference,
} from '../src/runtime/svg-download'

describe('SVG download sanitization', () => {
  it.each([
    '#gradient',
    '  #clip-path  ',
  ])('allows the same-document reference %j', (value) => {
    expect(isSafeSvgUrlReference(value)).toBe(true)
  })

  it.each([
    '',
    'https://example.com/image.svg',
    'data:image/svg+xml,<svg/>',
    'javascript:alert(1)',
    'vbscript:msgbox(1)',
    'blob:https://example.com/id',
  ])('rejects the non-fragment reference %j', (value) => {
    expect(isSafeSvgUrlReference(value)).toBe(false)
  })

  it.each([
    'fill: red',
    'fill: url(#gradient)',
    'filter: url("#shadow"); clip-path: url(\'#clip\')',
  ])('allows CSS that only uses same-document resources: %j', (value) => {
    expect(hasOnlySafeSvgCssReferences(value)).toBe(true)
  })

  it.each([
    '@import url("theme.css");',
    'fill: url(https://example.com/paint.svg#gradient)',
    'filter: url(data:image/svg+xml,<svg/>#filter)',
    'clip-path: url("javascript:alert(1)")',
  ])('rejects CSS that can load or execute an external resource: %j', (value) => {
    expect(hasOnlySafeSvgCssReferences(value)).toBe(false)
  })
})
