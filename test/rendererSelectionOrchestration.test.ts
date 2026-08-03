import { describe, expect, it, vi } from 'vitest'
import { createRendererSelectionAttemptCoordinator } from '../src/runtime/rendererSelectionOrchestration'

describe('Mermaid Renderer Selection orchestration', () => {
  it('ignores a superseded failure and commits only the current attempt', async () => {
    let resolveFirst!: (outcome: {
      readonly status: 'load-failed'
      readonly candidate: string
      readonly error: unknown
    }) => void
    let resolveCurrent!: (outcome: {
      readonly status: 'not-found'
      readonly candidate: string
    }) => void
    const firstResolution = new Promise<Parameters<typeof resolveFirst>[0]>((resolve) => {
      resolveFirst = resolve
    })
    const currentResolution = new Promise<Parameters<typeof resolveCurrent>[0]>((resolve) => {
      resolveCurrent = resolve
    })
    const commitCustomOwnership = vi.fn()
    const commitResolutionFailure = vi.fn()
    const dependencies = {
      commitCustomOwnership,
      commitResolutionFailure,
    }
    const beginAttempt = createRendererSelectionAttemptCoordinator()
    const commitFirst = beginAttempt()
    const firstSettled = firstResolution.then(outcome => commitFirst(outcome, dependencies))
    const commitCurrent = beginAttempt()
    const currentSettled = currentResolution.then(outcome => commitCurrent(outcome, dependencies))

    const staleFailure = new Error('stale chunk failure')
    resolveFirst({
      status: 'load-failed',
      candidate: 'SupersededRenderer',
      error: staleFailure,
    })
    await firstSettled

    expect(commitCustomOwnership).not.toHaveBeenCalled()
    expect(commitResolutionFailure).not.toHaveBeenCalled()

    const currentFailure = {
      status: 'not-found',
      candidate: 'CurrentRenderer',
    } as const
    resolveCurrent(currentFailure)
    await currentSettled

    expect(commitCustomOwnership).not.toHaveBeenCalled()
    expect(commitResolutionFailure).toHaveBeenCalledOnce()
    expect(commitResolutionFailure).toHaveBeenCalledWith(currentFailure)
  })
})
