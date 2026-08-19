import { getFontEmbedCSS, toBlob } from 'html-to-image'

const ERROR_PREFIX = '[nuxt-content-mermaid]'

export interface PngRasterizationInput {
  svg: SVGSVGElement
  width: number
  height: number
}

function validateDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || width <= 0
    || !Number.isFinite(height) || height <= 0) {
    throw new Error(`${ERROR_PREFIX} Invalid PNG snapshot dimensions`)
  }
}

function assertStylesheetsReadable(document: Document) {
  for (const stylesheet of Array.from(document.styleSheets)) {
    try {
      void stylesheet.cssRules
    }
    catch (cause) {
      throw new Error(
        `${ERROR_PREFIX} Cannot read stylesheet for PNG rasterization: ${stylesheet.href ?? '<inline stylesheet>'}`,
        { cause },
      )
    }
  }
}

function extractCssUrls(css: string): string[] | null {
  const lowerCss = css.toLowerCase()
  const urls: string[] = []
  let searchFrom = 0

  while (searchFrom < css.length) {
    const urlIndex = lowerCss.indexOf('url', searchFrom)
    if (urlIndex < 0) break

    const previous = css[urlIndex - 1]
    const afterUrl = urlIndex + 3
    if ((previous !== undefined && /[\w-]/.test(previous))
      || (css[afterUrl] !== undefined && /[\w-]/.test(css[afterUrl]))) {
      searchFrom = afterUrl
      continue
    }

    let cursor = afterUrl
    while (css[cursor] !== undefined && /[\t\n\f\r ]/.test(css[cursor]!))
      cursor++
    if (css[cursor] !== '(') return null
    cursor++
    while (css[cursor] !== undefined && /[\t\n\f\r ]/.test(css[cursor]!))
      cursor++

    const quote = css[cursor] === '"' || css[cursor] === '\''
      ? css[cursor]
      : null
    if (quote) cursor++

    const valueStart = cursor
    const valueEnd = quote
      ? css.indexOf(quote, valueStart)
      : css.indexOf(')', valueStart)
    if (valueEnd < 0) return null

    urls.push(css.slice(valueStart, valueEnd).trim())
    cursor = valueEnd + 1
    if (quote) {
      while (css[cursor] !== undefined && /[\t\n\f\r ]/.test(css[cursor]!))
        cursor++
      if (css[cursor] !== ')') return null
      cursor++
    }
    searchFrom = cursor
  }

  return urls
}

function assertFontsEmbedded(fontCss: string) {
  const urls = extractCssUrls(fontCss)
  if (!urls || urls.some(url => !url.toLowerCase().startsWith('data:'))) {
    throw new Error(
      `${ERROR_PREFIX} PNG font embedding left an external URL`,
    )
  }
}

function createRasterizationHost(
  document: Document,
  svg: SVGSVGElement,
  width: number,
  height: number,
) {
  const host = document.createElement('div')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    margin: '0px',
    padding: '0px',
    background: 'transparent',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '-1',
  })
  host.appendChild(svg.cloneNode(true))
  document.body.appendChild(host)
  return host
}

/** @internal */
export async function rasterizePngSnapshot(
  input: PngRasterizationInput,
): Promise<Blob> {
  validateDimensions(input.width, input.height)

  const document = input.svg.ownerDocument
  await document.fonts?.ready
  assertStylesheetsReadable(document)

  const captureOptions = {
    width: input.width,
    height: input.height,
    canvasWidth: input.width,
    canvasHeight: input.height,
    pixelRatio: 1,
  }
  const host = createRasterizationHost(
    document,
    input.svg,
    input.width,
    input.height,
  )

  try {
    const fontEmbedCSS = await getFontEmbedCSS(host, captureOptions)
    assertFontsEmbedded(fontEmbedCSS)
    const blob = await toBlob(host, {
      ...captureOptions,
      fontEmbedCSS,
    })

    if (!blob || blob.type !== 'image/png') {
      throw new Error(
        `${ERROR_PREFIX} PNG rasterization did not produce an image/png blob`,
      )
    }

    return blob
  }
  finally {
    host.remove()
  }
}
