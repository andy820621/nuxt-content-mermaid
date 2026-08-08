import type { MermaidConfig } from 'mermaid'
import { assertStrictData, cloneOwnedData } from './configuration/core'
import type { PageMermaidConfig } from '../types/config'
import { PAGE_MERMAID_CONFIG_PHASE } from './constants'
import { createMermaidComponentConfigurationError } from './component-configuration-error'
import {
  assertDirectMermaidConfig,
  collectDirectMermaidConfigDependencies,
} from './direct-mermaid-config'

interface MermaidComponentSourceInput {
  readonly pageConfig?: unknown
  readonly config?: unknown
}

export type MermaidComponentSource
  = | { readonly kind: 'runtime-only' }
    | { readonly kind: 'page', readonly config: PageMermaidConfig }
    | { readonly kind: 'direct', readonly config: MermaidConfig }
    | { readonly kind: 'conflict', readonly error: Error & { readonly code: string } }

type MermaidComponentSourceKind = MermaidComponentSource['kind']

function resolveSourceKind(input: MermaidComponentSourceInput): MermaidComponentSourceKind {
  const hasPageConfig = input.pageConfig !== undefined
  const hasDirectConfig = input.config !== undefined

  if (hasPageConfig && hasDirectConfig) return 'conflict'
  if (hasPageConfig) return 'page'
  if (hasDirectConfig) return 'direct'
  return 'runtime-only'
}

function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor && 'value' in descriptor ? descriptor.value : undefined
}

function validateInterpretedPageFields(value: object): void {
  const theme = ownValue(value, 'theme')
  if (theme !== undefined && typeof theme !== 'string') {
    throw createMermaidComponentConfigurationError('`pageConfig.theme` must be a string.')
  }

  const logLevel = ownValue(value, 'logLevel')
  if (logLevel !== undefined && typeof logLevel !== 'string' && typeof logLevel !== 'number') {
    throw createMermaidComponentConfigurationError('`pageConfig.logLevel` must be a string or number.')
  }

  const suppressErrorRendering = ownValue(value, 'suppressErrorRendering')
  if (suppressErrorRendering !== undefined && typeof suppressErrorRendering !== 'boolean') {
    throw createMermaidComponentConfigurationError('`pageConfig.suppressErrorRendering` must be a boolean.')
  }
}

function requirePageConfigObject(value: unknown): PageMermaidConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw createMermaidComponentConfigurationError('`pageConfig` must be a plain object.')
  }

  try {
    assertStrictData(value, PAGE_MERMAID_CONFIG_PHASE)
  }
  catch {
    throw createMermaidComponentConfigurationError('`pageConfig` must contain only strict pure data.')
  }

  validateInterpretedPageFields(value)

  return cloneOwnedData(value) as PageMermaidConfig
}

function requireDirectConfigObject(value: unknown): MermaidConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw createMermaidComponentConfigurationError('`config` must be an object.')
  }
  assertDirectMermaidConfig(value)
  return value
}

export function resolveMermaidComponentSource(
  input: MermaidComponentSourceInput,
): MermaidComponentSource {
  const sourceKind = resolveSourceKind(input)

  if (sourceKind === 'conflict') {
    return {
      kind: 'conflict',
      error: createMermaidComponentConfigurationError(
        '`pageConfig` and `config` cannot be supplied together.',
      ),
    }
  }
  if (sourceKind === 'page') return { kind: 'page', config: requirePageConfigObject(input.pageConfig) }
  if (sourceKind === 'direct') return { kind: 'direct', config: requireDirectConfigObject(input.config) }
  return { kind: 'runtime-only' }
}

export function collectMermaidComponentSourceDependencies(
  input: MermaidComponentSourceInput,
): readonly unknown[] {
  const sourceKind = resolveSourceKind(input)
  const sourceReferences = [input.pageConfig, input.config]

  if (sourceKind === 'conflict' || sourceKind === 'runtime-only')
    return sourceReferences

  return [
    ...sourceReferences,
    ...collectDirectMermaidConfigDependencies(
      sourceKind === 'page' ? input.pageConfig : input.config,
    ),
  ]
}
