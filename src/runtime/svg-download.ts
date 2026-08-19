const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink'
const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/'
const BLOCKED_ELEMENTS = 'script, iframe, object, embed'
const RESOURCE_ATTRIBUTES = new Set([
  'href',
  'xlink:href',
  'src',
  'data',
  'poster',
  'action',
  'formaction',
])

export const SVG_DOWNLOAD_FILENAME = 'mermaid-diagram.svg'
export const SVG_DOWNLOAD_MIME_TYPE = 'image/svg+xml;charset=utf-8'

/** @internal */
export function isSafeSvgUrlReference(value: string): boolean {
  const normalized = value.trim()
  return normalized.length > 1 && normalized.startsWith('#')
}

function isCssIdentifierCharacter(value: string | undefined) {
  return value !== undefined && /[\w-]/.test(value)
}

function isCssWhitespace(value: string | undefined) {
  return value !== undefined && /[\t\n\f\r ]/.test(value)
}

function extractCssUrlReferences(value: string): string[] | null {
  const lowerValue = value.toLowerCase()
  const references: string[] = []
  let searchFrom = 0

  while (searchFrom < value.length) {
    const urlIndex = lowerValue.indexOf('url', searchFrom)
    if (urlIndex < 0) break

    const afterUrl = urlIndex + 3
    if (isCssIdentifierCharacter(value[urlIndex - 1])
      || isCssIdentifierCharacter(value[afterUrl])) {
      searchFrom = afterUrl
      continue
    }

    let cursor = afterUrl
    while (isCssWhitespace(value[cursor])) cursor++
    if (value[cursor] !== '(') return null
    cursor++
    while (isCssWhitespace(value[cursor])) cursor++

    const quote = value[cursor] === '"' || value[cursor] === '\''
      ? value[cursor]
      : null
    if (quote) cursor++

    const referenceStart = cursor
    const referenceEnd = quote
      ? value.indexOf(quote, referenceStart)
      : value.indexOf(')', referenceStart)
    if (referenceEnd < 0) return null

    references.push(value.slice(referenceStart, referenceEnd).trim())
    cursor = referenceEnd + 1
    if (quote) {
      while (isCssWhitespace(value[cursor])) cursor++
      if (value[cursor] !== ')') return null
      cursor++
    }

    searchFrom = cursor
  }

  return references
}

/** @internal */
export function hasOnlySafeSvgCssReferences(value: string): boolean {
  const withoutComments = value.replace(/\/\*[\s\S]*?\*\//g, '')
  if (/@import\b/i.test(withoutComments)) return false
  if (/\\|(?:javascript|vbscript|data|blob)\s*:/i.test(withoutComments)) return false

  const references = extractCssUrlReferences(withoutComments)
  if (!references) return false
  if (references.some(reference => !isSafeSvgUrlReference(reference))) return false

  return true
}

function sanitizeSvgClone(svg: SVGSVGElement) {
  svg.querySelectorAll(BLOCKED_ELEMENTS).forEach(element => element.remove())

  svg.querySelectorAll('a').forEach((anchor) => {
    anchor.replaceWith(...anchor.childNodes)
  })

  const elements = [svg, ...svg.querySelectorAll('*')]
  for (const element of elements) {
    if (element.localName.toLowerCase() === 'style'
      && !hasOnlySafeSvgCssReferences(element.textContent ?? '')) {
      element.remove()
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on')) {
        element.removeAttributeNode(attribute)
        continue
      }

      if (RESOURCE_ATTRIBUTES.has(name)) {
        const isHref = name === 'href' || name === 'xlink:href'
        if (!isHref || !isSafeSvgUrlReference(attribute.value))
          element.removeAttributeNode(attribute)
        continue
      }

      if (!hasOnlySafeSvgCssReferences(attribute.value))
        element.removeAttributeNode(attribute)
    }
  }
}

function normalizeForeignObjectLabels(svg: SVGSVGElement) {
  for (const foreignObject of svg.querySelectorAll('foreignObject')) {
    foreignObject.setAttribute('overflow', 'visible')
    foreignObject.firstElementChild?.setAttribute('xmlns', XHTML_NAMESPACE)
  }
}

/** @internal */
export function serializeSafeStandaloneSvg(source: SVGSVGElement): string {
  const clone = source.cloneNode(true) as SVGSVGElement
  sanitizeSvgClone(clone)
  normalizeForeignObjectLabels(clone)
  clone.setAttribute('xmlns', SVG_NAMESPACE)
  if (clone.querySelector('[xlink\\:href]'))
    clone.setAttributeNS(XMLNS_NAMESPACE, 'xmlns:xlink', XLINK_NAMESPACE)
  return new XMLSerializer().serializeToString(clone)
}

interface SvgDownloadOptions {
  filename?: string
}

/** @internal */
export function downloadStandaloneSvg(
  source: SVGSVGElement,
  options: SvgDownloadOptions = {},
): void {
  const blob = new Blob(
    [serializeSafeStandaloneSvg(source)],
    { type: SVG_DOWNLOAD_MIME_TYPE },
  )
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = options.filename ?? SVG_DOWNLOAD_FILENAME
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
