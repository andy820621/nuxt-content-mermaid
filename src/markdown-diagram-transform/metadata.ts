import destr from 'destr'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { isRecord } from '../runtime/utils/is'

// Prevent prototype pollution via inline attribute paths.
const UNSAFE_INLINE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

export type MermaidFrontmatterInfo = {
  data: Record<string, unknown>
  startIndex: number
  endIndex: number
  indent: string
}

export type MermaidFrontmatterParseResult
  = | { kind: 'absent' }
    | { kind: 'invalid' }
    | { kind: 'valid', info: MermaidFrontmatterInfo }

export function inspectMermaidFrontmatter(rawCode: string, newline: string): MermaidFrontmatterParseResult {
  const lines = rawCode.split(newline)
  let startIndex = 0

  while (startIndex < lines.length) {
    const line = lines[startIndex]!
    const trimmed = line.trim()

    if (!trimmed) {
      startIndex += 1
      continue
    }

    if (isMermaidDirectiveStart(line)) {
      startIndex = skipMermaidDirective(lines, startIndex)
      continue
    }

    if (isMermaidCommentLine(line)) {
      startIndex += 1
      continue
    }

    break
  }

  if (startIndex >= lines.length)
    return { kind: 'absent' }

  const startLine = lines[startIndex]!
  if (startLine.trim() !== '---')
    return { kind: 'absent' }

  const indentMatch = startLine.match(/^\s*/)
  const indent = indentMatch ? indentMatch[0] : ''

  let endIndex = -1
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i]!.trim() === '---') {
      endIndex = i
      break
    }
  }

  if (endIndex === -1)
    return { kind: 'invalid' }

  const yamlLines = lines
    .slice(startIndex + 1, endIndex)
    .map(line => line.startsWith(indent) ? line.slice(indent.length) : line)
  const yamlRaw = yamlLines.join('\n').trim()

  try {
    const data = yamlRaw ? parseYaml(yamlRaw) : {}
    if (!isRecord(data))
      return { kind: 'invalid' }

    return {
      kind: 'valid',
      info: {
        data,
        startIndex,
        endIndex,
        indent,
      },
    }
  }
  catch {
    return { kind: 'invalid' }
  }
}

export function parseMermaidFrontmatter(rawCode: string, newline: string): MermaidFrontmatterInfo | null {
  const result = inspectMermaidFrontmatter(rawCode, newline)
  return result.kind === 'valid' ? result.info : null
}

function isMermaidDirectiveStart(line: string) {
  return line.trim().startsWith('%%{')
}

function isMermaidCommentLine(line: string) {
  const trimmed = line.trim()
  return trimmed.startsWith('%%') && !trimmed.startsWith('%%{')
}

function skipMermaidDirective(lines: string[], startIndex: number) {
  let index = startIndex
  while (index < lines.length) {
    if (lines[index]!.includes('}%%'))
      return index + 1
    index += 1
  }
  return lines.length
}

export function parseInlineAttrs(info: string): Record<string, unknown> | null {
  const attrsBlock = extractInlineAttrsBlock(info)
  if (attrsBlock === null)
    return null

  return parseInlineAttrsBlock(attrsBlock)
}

function extractInlineAttrsBlock(info: string): string | null {
  const startIndex = info.indexOf('{')
  if (startIndex === -1)
    return null

  let depth = 0
  let quote: '"' | '\'' | null = null

  for (let i = startIndex; i < info.length; i++) {
    const char = info[i]!

    if (quote) {
      if (char === quote && info[i - 1] !== '\\')
        quote = null
      continue
    }

    if (char === '"' || char === '\'') {
      quote = char
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0)
        return info.slice(startIndex + 1, i)
    }
  }

  return null
}

function parseInlineAttrsBlock(raw: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {}
  let index = 0

  while (index < raw.length) {
    index = skipSeparators(raw, index)
    if (index >= raw.length)
      break

    const keyStart = index
    while (index < raw.length && isAttrKeyChar(raw[index]!))
      index += 1

    const key = raw.slice(keyStart, index).trim()
    if (!key)
      break

    index = skipWhitespace(raw, index)

    let value: unknown = true
    if (index < raw.length && (raw[index] === '=' || raw[index] === ':')) {
      index += 1
      index = skipWhitespace(raw, index)

      const { value: rawValue, nextIndex, quoted } = readAttributeValue(raw, index)
      index = nextIndex
      value = parseAttributeValue(rawValue, quoted)
    }

    if (!setNestedValue(result, key, value))
      return null
  }

  return result
}

function skipWhitespace(input: string, index: number) {
  let cursor = index
  while (cursor < input.length) {
    const char = input[cursor]!
    if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r')
      break
    cursor += 1
  }
  return cursor
}

function skipSeparators(input: string, index: number) {
  let cursor = index
  while (cursor < input.length) {
    const char = input[cursor]!
    if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r' && char !== ';')
      break
    cursor += 1
  }
  return cursor
}

function isAttrKeyChar(char: string) {
  return /[\w.-]/.test(char)
}

function readAttributeValue(input: string, start: number) {
  const char = input[start]
  if (char === '"' || char === '\'')
    return readQuotedValue(input, start)

  if (char === '{' || char === '[')
    return readBalancedValue(input, start)

  let end = start
  while (end < input.length) {
    const current = input[end]!
    if (current === ';' || current === ' ' || current === '\t' || current === '\n' || current === '\r')
      break
    end += 1
  }

  return { value: input.slice(start, end), nextIndex: end, quoted: false }
}

function readQuotedValue(input: string, start: number) {
  const quote = input[start]!
  let cursor = start + 1
  let result = ''

  while (cursor < input.length) {
    const char = input[cursor]!

    if (char === '\\' && cursor + 1 < input.length) {
      result += input[cursor + 1]
      cursor += 2
      continue
    }

    if (char === quote) {
      return { value: result, nextIndex: cursor + 1, quoted: true }
    }

    result += char
    cursor += 1
  }

  return { value: result, nextIndex: cursor, quoted: true }
}

function readBalancedValue(input: string, start: number) {
  const open = input[start]!
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let quote: '"' | '\'' | null = null

  for (let i = start; i < input.length; i++) {
    const char = input[i]!

    if (quote) {
      if (char === quote && input[i - 1] !== '\\')
        quote = null
      continue
    }

    if (char === '"' || char === '\'') {
      quote = char
      continue
    }

    if (char === open) {
      depth += 1
      continue
    }

    if (char === close) {
      depth -= 1
      if (depth === 0) {
        return { value: input.slice(start, i + 1), nextIndex: i + 1, quoted: false }
      }
    }
  }

  return { value: input.slice(start), nextIndex: input.length, quoted: false }
}

function parseAttributeValue(raw: string, quoted: boolean) {
  const value = raw.trim()
  if (!value)
    return ''

  const isStructured = value.startsWith('{') || value.startsWith('[')

  if (quoted) {
    if (!isStructured)
      return value
    return parseStructuredValue(value)
  }

  if (isStructured)
    return parseStructuredValue(value)

  return destr(value)
}

function parseStructuredValue(value: string) {
  const parsed = destr(value)
  if (parsed !== value)
    return parsed

  try {
    const yamlParsed = parseYaml(value) as unknown
    if (isRecord(yamlParsed) || Array.isArray(yamlParsed))
      return yamlParsed
  }
  catch {
    // fall through to raw string
  }

  return value
}

function setNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.').filter(Boolean)
  if (!keys.length)
    return false

  let current = target
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!
    if (UNSAFE_INLINE_KEYS.has(key))
      return false

    if (i === keys.length - 1) {
      current[key] = value
      return true
    }

    const existing = current[key]
    if (!isRecord(existing)) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  return true
}
export function applyResolvedMermaidFrontmatter(
  rawCode: string,
  newline: string,
  frontmatterInfo: MermaidFrontmatterInfo | null,
  frontmatter: Record<string, unknown>,
  fallbackIndent: string,
) {
  const frontmatterLines = serializeMermaidFrontmatter(
    frontmatter,
    frontmatterInfo?.indent ?? fallbackIndent,
  )

  const lines = rawCode.split(newline)

  if (frontmatterInfo) {
    const before = lines.slice(0, frontmatterInfo.startIndex)
    const after = lines.slice(frontmatterInfo.endIndex + 1)
    return [...frontmatterLines, ...before, ...after].join(newline)
  }

  return [
    ...frontmatterLines,
    ...lines,
  ].join(newline)
}

function serializeMermaidFrontmatter(frontmatter: Record<string, unknown>, indent: string) {
  const yaml = stringifyYaml(frontmatter).trim()
  const yamlLines = yaml
    ? yaml.split('\n').map(line => `${indent}${line}`)
    : []

  const delimiter = `${indent}---`

  return [
    delimiter,
    ...yamlLines,
    delimiter,
  ]
}
