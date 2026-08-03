import type { Component } from 'vue'
import type { RendererSelectionSettledOutcome } from './rendererSelection'

type RendererSelectionFailureOutcome = Extract<
  RendererSelectionSettledOutcome,
  { readonly status: 'not-found' | 'load-failed' }
>

interface RendererSelectionAttemptCommitDependencies {
  readonly commitCustomOwnership: (component: Component) => void
  readonly commitResolutionFailure: (outcome: RendererSelectionFailureOutcome) => void
}

/** @internal */
export function createRendererSelectionAttemptCoordinator() {
  let latestAttemptId = 0

  return () => {
    const attemptId = ++latestAttemptId

    return (
      outcome: RendererSelectionSettledOutcome,
      dependencies: RendererSelectionAttemptCommitDependencies,
    ) => {
      if (attemptId !== latestAttemptId) return

      if (outcome.status === 'resolved')
        dependencies.commitCustomOwnership(outcome.component)
      else
        dependencies.commitResolutionFailure(outcome)
    }
  }
}
