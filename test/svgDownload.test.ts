import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSafeStandaloneSvgClone,
  downloadBlob,
  hasOnlySafeSvgCssReferences,
  isSafeSvgUrlReference,
  serializeSafeStandaloneSvg,
} from '../src/runtime/svg-download'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

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

  it('creates a detached standalone clone and serializes through the same clone contract', () => {
    const createClone = () => ({
      localName: 'svg',
      attributes: [],
      querySelectorAll: vi.fn(() => []),
      querySelector: vi.fn(() => null),
      setAttribute: vi.fn(),
    })
    const firstClone = createClone()
    const secondClone = createClone()
    const source = {
      cloneNode: vi.fn()
        .mockReturnValueOnce(firstClone)
        .mockReturnValueOnce(secondClone),
    } as unknown as SVGSVGElement
    const serializeToString = vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"/>')
    vi.stubGlobal('XMLSerializer', class {
      serializeToString = serializeToString
    })

    expect(createSafeStandaloneSvgClone(source)).toBe(firstClone)
    expect(serializeSafeStandaloneSvg(source)).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>')
    expect(source.cloneNode).toHaveBeenCalledTimes(2)
    expect(firstClone.setAttribute).toHaveBeenCalledWith(
      'xmlns',
      'http://www.w3.org/2000/svg',
    )
    expect(serializeToString).toHaveBeenCalledWith(secondClone)
  })

  it('downloads the supplied blob once and revokes its URL on the next task', () => {
    vi.useFakeTimers()
    const click = vi.fn()
    const remove = vi.fn()
    const anchor = {
      href: '',
      download: '',
      hidden: false,
      click,
      remove,
    }
    const appendChild = vi.fn()
    const createElement = vi.fn(() => anchor)
    vi.stubGlobal('document', {
      createElement,
      body: { appendChild },
    })
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:diagram')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const blob = new Blob(['png'], { type: 'image/png' })

    downloadBlob(blob, 'diagram.png')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(createElement).toHaveBeenCalledWith('a')
    expect(anchor).toMatchObject({
      href: 'blob:diagram',
      download: 'diagram.png',
      hidden: true,
    })
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(click).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagram')
  })
})
