import {
  ContentMermaidConfigurationError,
  assertStrictData,
  cloneOwnedData,
  mergeByPresence,
  type ConfigurationValidationPhase,
} from '../runtime/configuration/core'
import type { JsonObject, JsonValue } from '../types/config'
import type { MermaidToolbarOptions } from '../types/mermaid'

const MARKDOWN_METADATA_PHASE = {
  name: 'Markdown Mermaid Metadata',
  root: 'mermaid',
} as const satisfies ConfigurationValidationPhase

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const INLINE_ATTRIBUTE_KEYS = new Set(['title', 'displayMode', 'config', 'toolbar'])
const TOOLBAR_KEYS = new Set(['title', 'fontSize', 'fullscreenToolbarScale', 'buttons'])
const TOOLBAR_BUTTON_KEYS = new Set(['copy', 'fullscreen', 'expand'])

function hasOwn(value: JsonObject, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function valueAt(value: JsonObject, key: string): JsonValue | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor && 'value' in descriptor ? descriptor.value as JsonValue : undefined
}

function isPlainRecord(value: JsonValue): value is JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasUnsafeKeys(value: JsonValue): boolean {
  if (value === null || typeof value !== 'object') return false

  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Object.keys(descriptors)) {
    if (UNSAFE_KEYS.has(key)) return true

    const descriptor = descriptors[key]
    if (descriptor && 'value' in descriptor && hasUnsafeKeys(descriptor.value as JsonValue))
      return true
  }

  return false
}

function normalizeRecord(value: unknown): JsonObject | null {
  try {
    assertStrictData(value, MARKDOWN_METADATA_PHASE)
  }
  catch (error) {
    if (error instanceof ContentMermaidConfigurationError) return null
    throw error
  }

  if (!isPlainRecord(value) || hasUnsafeKeys(value)) return null

  return cloneOwnedData(value)
}

function hasOnlyKeys(value: JsonObject, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(Object.getOwnPropertyDescriptors(value)).every(key => allowedKeys.has(key))
}

function isStringifiableScalar(value: JsonValue): value is string | number | boolean | null {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function normalizeToolbar(value: unknown): MermaidToolbarOptions | null {
  const toolbar = normalizeRecord(value)
  if (!toolbar || !hasOnlyKeys(toolbar, TOOLBAR_KEYS)) return null

  const title = valueAt(toolbar, 'title')
  if (title !== undefined && typeof title !== 'string') return null

  const fontSize = valueAt(toolbar, 'fontSize')
  if (fontSize !== undefined && typeof fontSize !== 'string' && typeof fontSize !== 'number') return null

  const fullscreenToolbarScale = valueAt(toolbar, 'fullscreenToolbarScale')
  if (fullscreenToolbarScale !== undefined && typeof fullscreenToolbarScale !== 'number') return null

  const buttons = valueAt(toolbar, 'buttons')
  if (buttons !== undefined) {
    if (!isPlainRecord(buttons) || !hasOnlyKeys(buttons, TOOLBAR_BUTTON_KEYS)) return null
    for (const key of TOOLBAR_BUTTON_KEYS) {
      const button = valueAt(buttons, key)
      if (button !== undefined && typeof button !== 'boolean') return null
    }
  }

  return toolbar as MermaidToolbarOptions
}

/**
 * Validates an open Mermaid-owned page payload without discarding extension keys.
 */
export function resolveDiagramMermaidConfig(value: unknown): JsonObject | null {
  return normalizeRecord(value)
}

/**
 * Validates and normalizes the closed authoring syntax on a Mermaid fence.
 */
export function resolveFenceInlineAttributes(
  value: Record<string, unknown> | null,
): JsonObject | null {
  if (value === null) return null

  const attrs = normalizeRecord(value)
  if (!attrs || !hasOnlyKeys(attrs, INLINE_ATTRIBUTE_KEYS)) return null

  const normalized = cloneOwnedData(attrs)
  for (const key of ['title', 'displayMode'] as const) {
    if (!hasOwn(attrs, key)) continue

    const attribute = valueAt(attrs, key)
    if (attribute === undefined || !isStringifiableScalar(attribute)) return null
    normalized[key] = String(attribute)
  }

  if (hasOwn(attrs, 'config')) {
    const config = resolveDiagramMermaidConfig(valueAt(attrs, 'config'))
    if (!config) return null
    normalized.config = config
  }

  if (hasOwn(attrs, 'toolbar')) {
    const toolbar = resolveMarkdownToolbar([valueAt(attrs, 'toolbar')])
    if (toolbar === null || toolbar === undefined) return null
    normalized.toolbar = toolbar
  }

  return normalized
}

/**
 * Resolves open Mermaid YAML frontmatter only after every source has normalized.
 */
export function resolveMarkdownFrontmatter(
  layers: readonly (Record<string, unknown> | undefined)[],
): JsonObject | null {
  const normalizedLayers: JsonObject[] = []

  for (const layer of layers) {
    if (layer === undefined) continue

    const normalized = normalizeRecord(layer)
    if (!normalized) return null

    if (hasOwn(normalized, 'config')) {
      const config = resolveDiagramMermaidConfig(valueAt(normalized, 'config'))
      if (!config) return null
      normalized.config = config
    }

    if (hasOwn(normalized, 'toolbar')) {
      const toolbar = resolveMarkdownToolbar([valueAt(normalized, 'toolbar')])
      if (toolbar === null || toolbar === undefined) return null
      normalized.toolbar = toolbar
    }

    normalizedLayers.push(normalized)
  }

  return mergeByPresence(normalizedLayers)
}

/**
 * Resolves closed package-owned toolbar metadata without applying runtime defaults.
 */
export function resolveMarkdownToolbar(
  layers: readonly unknown[],
): MermaidToolbarOptions | undefined | null {
  const normalizedLayers: JsonObject[] = []

  for (const layer of layers) {
    if (layer === undefined) continue

    const toolbar = normalizeToolbar(layer)
    if (!toolbar) return null
    normalizedLayers.push(toolbar as JsonObject)
  }

  if (!normalizedLayers.length) return undefined
  return mergeByPresence(normalizedLayers) as MermaidToolbarOptions
}
