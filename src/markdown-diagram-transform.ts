import type { MermaidToolbarOptions } from './types/mermaid'
import {
  applyMermaidFrontmatterOverrides,
  extractMermaidInlineOverrides,
  extractToolbarProps,
  mergeToolbarProps,
  parseInlineAttrs,
  parseMermaidFrontmatter,
} from './runtime/utils/mermaid-transform'
import {
  isNonEmptyRecord,
  stringifyInlineValue,
} from './runtime/utils'

const MERMAID_COMPONENT_NAME = 'Mermaid'
const PAGE_MERMAID_CONFIG_BINDING = 'config'

export function transformMarkdownDiagrams(body: string) {
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  const lines = body.split(newline)
  const output: string[] = []

  // Track whether we're currently inside a fenced code block that is NOT a top-level mermaid fence.
  let inFence = false
  let fenceChar: '`' | '~' | null = null
  let fenceLength = 0

  const isClosingFence = (line: string) => {
    if (!fenceChar) return false
    const trimmed = line.trim()
    if (trimmed.length < fenceLength) return false
    for (const char of trimmed) {
      if (char !== fenceChar) return false
    }
    return true
  }

  const isFenceMarkerChar = (char: string | undefined): char is '`' | '~' =>
    char === '`' || char === '~'

  const parseFence = (line: string) => {
    let index = 0
    while (index < line.length && (line[index] === ' ' || line[index] === '\t'))
      index++

    const indent = line.slice(0, index)
    const markerChar = line[index]
    if (!isFenceMarkerChar(markerChar))
      return null

    let markerEnd = index
    while (markerEnd < line.length && line[markerEnd] === markerChar)
      markerEnd++

    const markerLength = markerEnd - index
    if (markerLength < 3)
      return null

    return {
      indent,
      markerChar,
      markerLength,
      info: line.slice(markerEnd).trim(),
    }
  }

  const isMermaidFence = (info: string) => {
    // Accept "mermaid" as the fence info string and allow common MDC/MD meta:
    // e.g. "mermaid", "mermaid {..}", "mermaid [..]".
    if (!info) return false
    const lower = info.toLowerCase()
    if (!lower.startsWith('mermaid')) return false

    const next = lower.slice('mermaid'.length, 'mermaid'.length + 1)
    return next === '' || /\s/.test(next) || next === '{' || next === '['
  }

  const buildComponentTag = (encoded: string, toolbar?: MermaidToolbarOptions) => {
    const attrs = [
      `:config="${PAGE_MERMAID_CONFIG_BINDING}"`,
    ]

    if (toolbar && isNonEmptyRecord(toolbar)) {
      attrs.push(`:toolbar='${stringifyInlineValue(toolbar)}'`)
    }

    attrs.push(`code="${encoded}"`)
    return `<${MERMAID_COMPONENT_NAME} ${attrs.join(' ')}></${MERMAID_COMPONENT_NAME}>`
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!

    if (inFence) {
      output.push(line)
      if (isClosingFence(line)) {
        inFence = false
        fenceChar = null
        fenceLength = 0
      }
      continue
    }

    const fence = parseFence(line)
    if (!fence) {
      output.push(line)
      continue
    }

    // Only transform top-level mermaid fences; treat other fenced code blocks as opaque.
    if (!isMermaidFence(fence.info)) {
      // Enter an opaque fence: everything is emitted as-is until its closing fence.
      inFence = true
      fenceChar = fence.markerChar
      fenceLength = fence.markerLength
      output.push(line)
      continue
    }

    // Find the matching closing fence (same char, at least same length).
    let closingIndex = -1
    for (let j = index + 1; j < lines.length; j++) {
      const trimmed = lines[j]!.trim()
      if (trimmed.length < fence.markerLength) continue
      let isFence = true
      for (const char of trimmed) {
        if (char !== fence.markerChar) {
          isFence = false
          break
        }
      }
      if (isFence) {
        closingIndex = j
        break
      }
    }

    // If the fence is unclosed, leave it untouched.
    if (closingIndex === -1) {
      output.push(line)
      continue
    }

    const rawCode = lines.slice(index + 1, closingIndex).join(newline)
    const code = rawCode.trim()

    if (!code) {
      output.push(...lines.slice(index, closingIndex + 1))
      index = closingIndex
      continue
    }

    const inlineAttrs = parseInlineAttrs(fence.info)
    const frontmatterInfo = parseMermaidFrontmatter(rawCode, newline)
    const inlineOverrides = extractMermaidInlineOverrides(inlineAttrs)
    const mergedCode = inlineOverrides
      ? applyMermaidFrontmatterOverrides(rawCode, newline, frontmatterInfo, inlineOverrides, fence.indent)
      : rawCode

    const toolbarProps = mergeToolbarProps(
      extractToolbarProps(frontmatterInfo?.data),
      extractToolbarProps(inlineAttrs),
    )

    const encoded = encodeURIComponent(mergedCode.trim())
    output.push(`${fence.indent}${buildComponentTag(encoded, toolbarProps)}`)
    index = closingIndex
  }

  return output.join(newline)
}
