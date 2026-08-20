import { getFontEmbedCSS } from 'html-to-image'

const ERROR_PREFIX = '[nuxt-content-mermaid]'
const CSS_IMPORT_RULE = 3
const CSS_FONT_FACE_RULE = 5

type FontEmbeddingOptions = NonNullable<Parameters<typeof getFontEmbedCSS>[1]>

interface FontUsage {
  families: string[]
  style: string
  weight: string
  stretch: string
  text: string
}

interface FontRuleCandidate {
  rule: CSSFontFaceRule
  importHref?: string
}

interface CollectedFontRules {
  candidates: FontRuleCandidate[]
  unreadableStylesheets: string[]
}

function normalizeFontFamily(value: string) {
  const trimmed = value.trim()
  const quote = trimmed[0]
  const unquoted = (quote === '"' || quote === '\'') && trimmed.at(-1) === quote
    ? trimmed.slice(1, -1)
    : trimmed
  return unquoted.replace(/\\([\\'" ])/g, '$1').toLocaleLowerCase()
}

function splitFontFamilies(value: string) {
  const families: string[] = []
  let current = ''
  let quote = ''
  let escaped = false

  for (const character of value) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\') {
      current += character
      escaped = true
      continue
    }
    if (quote) {
      current += character
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === '\'') {
      current += character
      quote = character
      continue
    }
    if (character === ',') {
      families.push(normalizeFontFamily(current))
      current = ''
      continue
    }
    current += character
  }

  families.push(normalizeFontFamily(current))
  return families.filter(Boolean)
}

function directTextContent(element: Element) {
  return Array.from(element.childNodes)
    .filter(node => node.nodeType === 3)
    .map(node => node.textContent ?? '')
    .join('')
}

function collectFontUsages(captureNode: HTMLElement): FontUsage[] {
  const view = captureNode.ownerDocument.defaultView
  if (!view) return []

  const elements = [captureNode, ...Array.from(captureNode.querySelectorAll('*'))]
  return elements.flatMap((element) => {
    const text = directTextContent(element)
    if (!text.trim()) return []

    const style = view.getComputedStyle(element)
    const families = splitFontFamilies(style.fontFamily)
    if (families.length === 0) return []

    return [{
      families,
      style: style.fontStyle || 'normal',
      weight: style.fontWeight || '400',
      stretch: style.fontStretch || 'normal',
      text,
    }]
  })
}

function normalizeFontStyle(value: string) {
  return value.trim().toLocaleLowerCase().split(/\s+/)[0] || 'normal'
}

function parseWeight(value: string) {
  const normalized = value.trim().toLocaleLowerCase()
  if (normalized === 'normal') return 400
  if (normalized === 'bold') return 700
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const stretchKeywords: Record<string, number> = {
  'ultra-condensed': 50,
  'extra-condensed': 62.5,
  'condensed': 75,
  'semi-condensed': 87.5,
  'normal': 100,
  'semi-expanded': 112.5,
  'expanded': 125,
  'extra-expanded': 150,
  'ultra-expanded': 200,
}

function parseStretch(value: string) {
  const normalized = value.trim().toLocaleLowerCase()
  if (stretchKeywords[normalized] !== undefined) return stretchKeywords[normalized]
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function descriptorBounds(
  value: string,
  parser: (part: string) => number | null,
  fallback: string,
): [number, number] | null {
  const parts = (value.trim() || fallback).split(/\s+/)
  const first = parser(parts[0]!)
  const last = parser(parts[1] ?? parts[0]!)
  return first === null || last === null
    ? null
    : [Math.min(first, last), Math.max(first, last)]
}

function numericDescriptorContains(
  descriptor: string,
  actual: string,
  parser: (part: string) => number | null,
  fallback: string,
) {
  const bounds = descriptorBounds(descriptor, parser, fallback)
  const value = parser(actual)
  return bounds === null || value === null
    ? (descriptor.trim() || fallback).toLocaleLowerCase() === actual.trim().toLocaleLowerCase()
    : value >= bounds[0] && value <= bounds[1]
}

function numericDescriptorsEqual(
  left: string,
  right: string,
  parser: (part: string) => number | null,
  fallback: string,
) {
  const leftBounds = descriptorBounds(left, parser, fallback)
  const rightBounds = descriptorBounds(right, parser, fallback)
  if (!leftBounds || !rightBounds)
    return (left.trim() || fallback).toLocaleLowerCase() === (right.trim() || fallback).toLocaleLowerCase()
  return leftBounds[0] === rightBounds[0] && leftBounds[1] === rightBounds[1]
}

type UnicodeRange = [number, number]

function parseUnicodeRanges(value: string): UnicodeRange[] | null {
  const source = value.trim() || 'U+0-10FFFF'
  const ranges: UnicodeRange[] = []

  for (const rawPart of source.split(',')) {
    const part = rawPart.trim().toLocaleUpperCase()
    const match = /^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/.exec(part)
    if (!match) return null

    const startToken = match[1]!
    const endToken = match[2]
    const start = Number.parseInt(startToken.replaceAll('?', '0'), 16)
    const end = Number.parseInt(
      endToken ?? startToken.replaceAll('?', 'F'),
      16,
    )
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    ranges.push([start, end])
  }

  return ranges
}

function unicodeRangeKey(value: string) {
  const ranges = parseUnicodeRanges(value)
  return ranges
    ? ranges.map(([start, end]) => `${start.toString(16)}-${end.toString(16)}`).join(',')
    : value.replace(/\s+/g, '').toLocaleLowerCase()
}

function unicodeRangeContainsText(value: string, text: string) {
  const ranges = parseUnicodeRanges(value)
  if (!ranges) return true
  return Array.from(text).some((character) => {
    const codePoint = character.codePointAt(0)!
    return ranges.some(([start, end]) => codePoint >= start && codePoint <= end)
  })
}

function fontFaceMatchesUsage(face: FontFace, usage: FontUsage) {
  return usage.families.includes(normalizeFontFamily(face.family))
    && normalizeFontStyle(face.style) === normalizeFontStyle(usage.style)
    && numericDescriptorContains(face.weight, usage.weight, parseWeight, 'normal')
    && numericDescriptorContains(face.stretch, usage.stretch, parseStretch, 'normal')
    && unicodeRangeContainsText(face.unicodeRange, usage.text)
}

function ruleMatchesUsage(rule: CSSFontFaceRule, usage: FontUsage) {
  const style = rule.style
  return usage.families.includes(normalizeFontFamily(style.getPropertyValue('font-family')))
    && normalizeFontStyle(style.getPropertyValue('font-style') || 'normal') === normalizeFontStyle(usage.style)
    && numericDescriptorContains(style.getPropertyValue('font-weight'), usage.weight, parseWeight, 'normal')
    && numericDescriptorContains(style.getPropertyValue('font-stretch'), usage.stretch, parseStretch, 'normal')
    && unicodeRangeContainsText(style.getPropertyValue('unicode-range'), usage.text)
}

function ruleMatchesFontFace(rule: CSSFontFaceRule, face: FontFace) {
  const style = rule.style
  return normalizeFontFamily(style.getPropertyValue('font-family')) === normalizeFontFamily(face.family)
    && normalizeFontStyle(style.getPropertyValue('font-style') || 'normal') === normalizeFontStyle(face.style)
    && numericDescriptorsEqual(style.getPropertyValue('font-weight'), face.weight, parseWeight, 'normal')
    && numericDescriptorsEqual(style.getPropertyValue('font-stretch'), face.stretch, parseStretch, 'normal')
    && unicodeRangeKey(style.getPropertyValue('unicode-range')) === unicodeRangeKey(face.unicodeRange)
}

function collectFontRules(document: Document): CollectedFontRules {
  const candidates: FontRuleCandidate[] = []
  const unreadableStylesheets: string[] = []
  const visited = new Set<CSSStyleSheet>()

  const visitRules = (rules: CSSRuleList, importHref?: string) => {
    for (const rule of Array.from(rules)) {
      if (rule.type === CSS_FONT_FACE_RULE) {
        candidates.push({ rule: rule as CSSFontFaceRule, importHref })
        continue
      }
      if (rule.type === CSS_IMPORT_RULE) {
        const importRule = rule as CSSImportRule
        const href = importRule.href || importRule.styleSheet?.href || '<inline stylesheet>'
        if (importRule.styleSheet)
          visitStylesheet(importRule.styleSheet, href)
        else
          unreadableStylesheets.push(href)
        continue
      }
      if ('cssRules' in rule) {
        try {
          visitRules((rule as CSSGroupingRule).cssRules, importHref)
        }
        catch {
          unreadableStylesheets.push(rule.parentStyleSheet?.href ?? '<inline stylesheet>')
        }
      }
    }
  }

  const visitStylesheet = (stylesheet: CSSStyleSheet, importHref?: string) => {
    if (visited.has(stylesheet)) return
    visited.add(stylesheet)
    try {
      visitRules(stylesheet.cssRules, importHref)
    }
    catch {
      unreadableStylesheets.push(stylesheet.href ?? importHref ?? '<inline stylesheet>')
    }
  }

  for (const stylesheet of Array.from(document.styleSheets))
    visitStylesheet(stylesheet)

  return { candidates, unreadableStylesheets }
}

function resolveFontSourceUrls(value: string, baseUrl: string) {
  const lowerValue = value.toLocaleLowerCase()
  let result = ''
  let searchFrom = 0

  while (searchFrom < value.length) {
    const urlIndex = lowerValue.indexOf('url', searchFrom)
    if (urlIndex < 0) break

    const previous = value[urlIndex - 1]
    const afterUrl = urlIndex + 3
    if ((previous !== undefined && /[\w-]/.test(previous))
      || (value[afterUrl] !== undefined && /[\w-]/.test(value[afterUrl]!))) {
      result += value.slice(searchFrom, afterUrl)
      searchFrom = afterUrl
      continue
    }

    let cursor = afterUrl
    while (value[cursor] !== undefined && /[\t\n\f\r ]/.test(value[cursor]!))
      cursor++
    if (value[cursor] !== '(') {
      result += value.slice(searchFrom, afterUrl)
      searchFrom = afterUrl
      continue
    }

    cursor++
    while (value[cursor] !== undefined && /[\t\n\f\r ]/.test(value[cursor]!))
      cursor++
    const quote = value[cursor] === '"' || value[cursor] === '\''
      ? value[cursor]
      : null
    if (quote) cursor++

    const valueStart = cursor
    const valueEnd = quote
      ? value.indexOf(quote, valueStart)
      : value.indexOf(')', valueStart)
    if (valueEnd < 0) break

    const rawUrl = value.slice(valueStart, valueEnd).trim()
    cursor = valueEnd + 1
    if (quote) {
      while (value[cursor] !== undefined && /[\t\n\f\r ]/.test(value[cursor]!))
        cursor++
      if (value[cursor] !== ')') break
      cursor++
    }

    result += value.slice(searchFrom, urlIndex)
    result += `url("${new URL(rawUrl, baseUrl).href}")`
    searchFrom = cursor
  }

  return result + value.slice(searchFrom)
}

function serializeFontRule(candidate: FontRuleCandidate, document: Document) {
  const descriptors: Array<[string, string, string]> = []
  const style = candidate.rule.style
  const baseUrl = candidate.rule.parentStyleSheet?.href ?? document.baseURI

  for (let index = 0; index < style.length; index++) {
    const name = style.item(index)
    const value = name === 'src'
      ? resolveFontSourceUrls(style.getPropertyValue(name), baseUrl)
      : style.getPropertyValue(name)
    descriptors.push([name, value, style.getPropertyPriority(name)])
  }

  descriptors.sort(([left], [right]) => left.localeCompare(right))
  return `@font-face { ${descriptors.map(([name, value, priority]) =>
    `${name}: ${value}${priority ? ` !${priority}` : ''};`,
  ).join(' ')} }`
}

/** @internal */
export function supportsScopedPngFontEmbedding(document: Document) {
  return Boolean(
    document.defaultView
    && typeof document.implementation?.createHTMLDocument === 'function'
    && document.fonts
    && typeof document.fonts[Symbol.iterator] === 'function',
  )
}

/** @internal */
export async function getScopedPngFontEmbedCSS(
  captureNode: HTMLElement,
  options: FontEmbeddingOptions,
) {
  const document = captureNode.ownerDocument
  const usages = collectFontUsages(captureNode)
  const activeFaces = Array.from(document.fonts)
    .filter(face => face.status !== 'unloaded')
    .filter(face => usages.some(usage => fontFaceMatchesUsage(face, usage)))

  if (activeFaces.length === 0) return ''

  const { candidates, unreadableStylesheets } = collectFontRules(document)
  const matchingCandidates = candidates.filter(candidate =>
    usages.some(usage => ruleMatchesUsage(candidate.rule, usage))
    && activeFaces.some(face => ruleMatchesFontFace(candidate.rule, face)),
  )

  for (const face of activeFaces) {
    if (matchingCandidates.some(candidate => ruleMatchesFontFace(candidate.rule, face))) continue
    const unreadable = unreadableStylesheets[0]
    if (unreadable) {
      throw new Error(
        `${ERROR_PREFIX} Cannot read stylesheet for PNG rasterization: ${unreadable}`,
      )
    }
    throw new Error(
      `${ERROR_PREFIX} Cannot access @font-face for PNG rasterization: ${face.family}`,
    )
  }

  const uniqueRules = new Map<string, FontRuleCandidate>()
  const candidatesByPreference = [...matchingCandidates]
    .sort((left, right) => Number(Boolean(left.importHref)) - Number(Boolean(right.importHref)))
  for (const candidate of candidatesByPreference) {
    const cssText = serializeFontRule(candidate, document)
    if (!uniqueRules.has(cssText)) uniqueRules.set(cssText, candidate)
  }

  for (const candidate of uniqueRules.values()) {
    if (!candidate.importHref) continue
    throw new Error(
      `${ERROR_PREFIX} CSS @import is not supported for PNG rasterization: ${candidate.importHref}`,
    )
  }

  const isolatedDocument = document.implementation.createHTMLDocument('')
  const styleElement = isolatedDocument.createElement('style')
  isolatedDocument.head.appendChild(styleElement)
  const stylesheet = styleElement.sheet
  if (!stylesheet) {
    throw new Error(`${ERROR_PREFIX} Cannot create isolated stylesheet for PNG rasterization`)
  }

  for (const cssText of uniqueRules.keys())
    stylesheet.insertRule(cssText, stylesheet.cssRules.length)

  const embeddingNode = isolatedDocument.createElement('div')
  isolatedDocument.body.appendChild(embeddingNode)
  return getFontEmbedCSS(embeddingNode, options)
}
