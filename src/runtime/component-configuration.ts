import type { MermaidConfig } from 'mermaid'
import { assertStrictData, cloneOwnedData } from '../configuration/core'
import type { PageMermaidConfig } from '../types/config'
import { PAGE_MERMAID_CONFIG_PHASE } from './constants'

interface MermaidComponentSourceInput {
  readonly pageConfig?: unknown
  readonly config?: unknown
}

export type MermaidComponentSource
  = | { readonly kind: 'runtime-only' }
    | { readonly kind: 'page', readonly config: PageMermaidConfig }
    | { readonly kind: 'direct', readonly config: MermaidConfig }
    | { readonly kind: 'conflict', readonly error: Error & { readonly code: string } }

class MermaidComponentConfigurationError extends Error {
  readonly code = 'CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR'
  override readonly name = 'MermaidComponentConfigurationError'
}

function configurationError(message: string): MermaidComponentConfigurationError {
  return new MermaidComponentConfigurationError(message)
}

function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor && 'value' in descriptor ? descriptor.value : undefined
}

function validateInterpretedPageFields(value: object): void {
  const theme = ownValue(value, 'theme')
  if (theme !== undefined && typeof theme !== 'string') {
    throw configurationError('`pageConfig.theme` must be a string.')
  }

  const logLevel = ownValue(value, 'logLevel')
  if (logLevel !== undefined && typeof logLevel !== 'string' && typeof logLevel !== 'number') {
    throw configurationError('`pageConfig.logLevel` must be a string or number.')
  }

  const suppressErrorRendering = ownValue(value, 'suppressErrorRendering')
  if (suppressErrorRendering !== undefined && typeof suppressErrorRendering !== 'boolean') {
    throw configurationError('`pageConfig.suppressErrorRendering` must be a boolean.')
  }
}

function requirePageConfigObject(value: unknown): PageMermaidConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw configurationError('`pageConfig` must be a plain object.')
  }

  try {
    assertStrictData(value, PAGE_MERMAID_CONFIG_PHASE)
  }
  catch {
    throw configurationError('`pageConfig` must contain only strict pure data.')
  }

  validateInterpretedPageFields(value)

  return cloneOwnedData(value) as PageMermaidConfig
}

function requireDirectConfigObject(value: unknown): MermaidConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw configurationError('`config` must be an object.')
  }
  return value as MermaidConfig
}

export function resolveMermaidComponentSource(
  input: MermaidComponentSourceInput,
): MermaidComponentSource {
  const hasPageConfig = input.pageConfig !== undefined
  const hasDirectConfig = input.config !== undefined

  if (hasPageConfig && hasDirectConfig) {
    return {
      kind: 'conflict',
      error: configurationError(
        '`pageConfig` and `config` cannot be supplied together.',
      ),
    }
  }
  if (hasPageConfig) return { kind: 'page', config: requirePageConfigObject(input.pageConfig) }
  if (hasDirectConfig) return { kind: 'direct', config: requireDirectConfigObject(input.config) }
  return { kind: 'runtime-only' }
}
