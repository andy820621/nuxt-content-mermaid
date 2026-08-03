class MermaidComponentConfigurationError extends Error {
  readonly code = 'CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR'
  override readonly name = 'MermaidComponentConfigurationError'
}

export function createMermaidComponentConfigurationError(
  message: string,
): Error & { readonly code: string } {
  return new MermaidComponentConfigurationError(message)
}
