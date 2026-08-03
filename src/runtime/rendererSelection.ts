import type { Component } from 'vue'

export type RendererSelectionSettledOutcome
  = | { readonly status: 'resolved', readonly candidate: string, readonly component: Component }
    | { readonly status: 'not-found', readonly candidate: string }
    | { readonly status: 'load-failed', readonly candidate: string, readonly error: unknown }

export type RendererSelectionOutcome
  = | { readonly status: 'no-candidate' }
    | { readonly status: 'pending', readonly candidate: string, readonly resolution: Promise<RendererSelectionSettledOutcome> }
    | RendererSelectionSettledOutcome

type InitialRendererSelectionOutcome = Extract<
  RendererSelectionOutcome,
  { readonly status: 'no-candidate' | 'pending' }
>

export interface RendererSelectionDependencies {
  readonly loadComponent: (candidate: string) => Promise<Component | null>
}

type RendererSelectionFailureOutcome = Extract<
  RendererSelectionSettledOutcome,
  { readonly status: 'not-found' | 'load-failed' }
>

type RendererSelectionDiagnostic = {
  readonly event: 'resolution-failed'
  readonly candidate: string
  readonly reason: RendererSelectionFailureOutcome['status']
  readonly error?: unknown
}

interface RendererResolutionFailureHandoffDependencies {
  readonly reportDiagnostic: (diagnostic: RendererSelectionDiagnostic) => void
  readonly commitBuiltInOwnership: () => void
}

/** @internal */
export function createRendererResolutionFailureHandoff(
  dependencies: RendererResolutionFailureHandoffDependencies,
) {
  let committed = false

  return (outcome: RendererSelectionFailureOutcome) => {
    if (committed) return
    committed = true

    const diagnostic: RendererSelectionDiagnostic = outcome.status === 'load-failed'
      ? {
          event: 'resolution-failed',
          candidate: outcome.candidate,
          reason: outcome.status,
          error: outcome.error,
        }
      : {
          event: 'resolution-failed',
          candidate: outcome.candidate,
          reason: outcome.status,
        }

    dependencies.reportDiagnostic(diagnostic)
    dependencies.commitBuiltInOwnership()
  }
}

async function resolveCandidate(
  candidate: string,
  loadComponent: RendererSelectionDependencies['loadComponent'],
): Promise<RendererSelectionSettledOutcome> {
  try {
    const component = await loadComponent(candidate)
    return component
      ? { status: 'resolved', candidate, component }
      : { status: 'not-found', candidate }
  }
  catch (error) {
    return { status: 'load-failed', candidate, error }
  }
}

export function selectRenderer(
  configuredCandidate: string | undefined,
  dependencies: RendererSelectionDependencies,
): InitialRendererSelectionOutcome {
  const candidate = configuredCandidate?.trim()
  if (!candidate) return { status: 'no-candidate' }

  return {
    status: 'pending',
    candidate,
    resolution: resolveCandidate(candidate, dependencies.loadComponent),
  }
}
