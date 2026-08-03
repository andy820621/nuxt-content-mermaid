import type { MermaidToolbarOptions } from './types/mermaid'
import {
  applyResolvedMermaidFrontmatter,
  inspectMermaidFrontmatter,
  parseInlineAttrs,
} from './markdown-diagram-transform/metadata'
import {
  resolveFenceInlineAttributes,
  resolveMarkdownFrontmatter,
  resolveMarkdownToolbar,
} from './markdown-diagram-transform/configuration'
import { isNonEmptyRecord } from './runtime/utils/is'

const MERMAID_COMPONENT_NAME = 'Mermaid'
const PAGE_MERMAID_CONFIG_EXPRESSION = 'config'

function serializeInlineAttributeRecord(value: Record<string, unknown>) {
  return JSON.stringify(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

function isClosingFence(line: string, markerChar: '`' | '~', markerLength: number) {
  const trimmed = line.trim()
  if (trimmed.length < markerLength) return false
  for (const char of trimmed) {
    if (char !== markerChar) return false
  }
  return true
}

export function transformMarkdownDiagrams(body: string) {
  const newline = body.includes('\r\n') ? '\r\n' : '\n'
  const lines = body.split(newline)
  const output: string[] = []

  // Track whether we're currently inside a fenced code block that is NOT a top-level mermaid fence.
  let inFence = false
  let fenceChar: '`' | '~' | null = null
  let fenceLength = 0

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
      `:page-config="${PAGE_MERMAID_CONFIG_EXPRESSION}"`,
    ]

    if (toolbar && isNonEmptyRecord(toolbar)) {
      attrs.push(`:toolbar='${serializeInlineAttributeRecord(toolbar)}'`)
    }

    attrs.push(`code="${encoded}"`)
    return `<${MERMAID_COMPONENT_NAME} ${attrs.join(' ')}></${MERMAID_COMPONENT_NAME}>`
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!

    if (inFence) {
      output.push(line)
      if (fenceChar && isClosingFence(line, fenceChar, fenceLength)) {
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
      if (isClosingFence(lines[j]!, fence.markerChar, fence.markerLength)) {
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
    if (fence.info.includes('{') && !inlineAttrs) {
      output.push(...lines.slice(index, closingIndex + 1))
      index = closingIndex
      continue
    }

    const frontmatterResult = inspectMermaidFrontmatter(rawCode, newline)
    if (frontmatterResult.kind === 'invalid') {
      output.push(...lines.slice(index, closingIndex + 1))
      index = closingIndex
      continue
    }
    const frontmatterInfo = frontmatterResult.kind === 'valid'
      ? frontmatterResult.info
      : null

    const inlineOverrides = resolveFenceInlineAttributes(inlineAttrs)
    if (inlineAttrs && !inlineOverrides) {
      output.push(...lines.slice(index, closingIndex + 1))
      index = closingIndex
      continue
    }

    const resolvedFrontmatter = resolveMarkdownFrontmatter([
      frontmatterInfo?.data,
      inlineOverrides ?? undefined,
    ])
    const toolbarProps = resolveMarkdownToolbar([
      frontmatterInfo?.data.toolbar,
      inlineOverrides?.toolbar,
    ])
    if (resolvedFrontmatter === null || toolbarProps === null) {
      output.push(...lines.slice(index, closingIndex + 1))
      index = closingIndex
      continue
    }

    const hasInlineOverrides = inlineOverrides && Object.keys(inlineOverrides).length > 0
    const mergedCode = frontmatterInfo || hasInlineOverrides
      ? applyResolvedMermaidFrontmatter(rawCode, newline, frontmatterInfo, resolvedFrontmatter, fence.indent)
      : rawCode

    const encoded = encodeURIComponent(mergedCode.trim())
    output.push(`${fence.indent}${buildComponentTag(encoded, toolbarProps)}`)
    index = closingIndex
  }

  return output.join(newline)
}
