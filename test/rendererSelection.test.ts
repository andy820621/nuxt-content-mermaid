import type { Component } from 'vue'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { RendererSelectionOutcome } from '../src/runtime/rendererSelection'
import {
  createRendererResolutionFailureHandoff,
  selectRenderer,
} from '../src/runtime/rendererSelection'

function collectSemanticValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(collectSemanticValues)
  if (value instanceof Error || value === null || typeof value !== 'object') return [value]
  return Object.values(value).flatMap(collectSemanticValues)
}

describe('Renderer Selection', () => {
  it.each([undefined, '', '   '])('returns no-candidate without loading for %j', (candidate) => {
    const loadComponent = vi.fn()

    expect(selectRenderer(candidate, { loadComponent })).toEqual({ status: 'no-candidate' })
    expect(loadComponent).not.toHaveBeenCalled()
  })

  it('returns pending immediately and resolves the normalized candidate', async () => {
    const component = { name: 'CustomRenderer' } satisfies Component
    let finishLoading!: (value: Component | null) => void
    const loading = new Promise<Component | null>((resolve) => {
      finishLoading = resolve
    })
    const loadComponent = vi.fn(() => loading)

    const outcome = selectRenderer('  CustomRenderer.vue  ', { loadComponent })

    expect(outcome.status).toBe('pending')
    if (outcome.status !== 'pending') throw new Error('Expected pending Renderer Selection')
    expect(outcome.candidate).toBe('CustomRenderer.vue')
    expect(loadComponent).toHaveBeenCalledOnce()
    expect(loadComponent).toHaveBeenCalledWith('CustomRenderer.vue')

    finishLoading(component)
    await expect(outcome.resolution).resolves.toEqual({
      status: 'resolved',
      candidate: 'CustomRenderer.vue',
      component,
    })
  })

  it('distinguishes not-found from load-failed Custom Renderer Candidate outcomes', async () => {
    const notFound = selectRenderer('MissingRenderer', {
      loadComponent: async () => null,
    })
    const failure = new Error('chunk unavailable')
    const loadFailed = selectRenderer('BrokenRenderer', {
      loadComponent: async () => { throw failure },
    })

    expect(notFound.status).toBe('pending')
    expect(loadFailed.status).toBe('pending')
    if (notFound.status !== 'pending' || loadFailed.status !== 'pending')
      throw new Error('Expected pending Renderer Selections')

    await expect(notFound.resolution).resolves.toEqual({
      status: 'not-found',
      candidate: 'MissingRenderer',
    })
    await expect(loadFailed.resolution).resolves.toEqual({
      status: 'load-failed',
      candidate: 'BrokenRenderer',
      error: failure,
    })
  })

  it('reports a not-found diagnostic before committing Built-in ownership once per attempt', () => {
    const order: string[] = []
    const reported: unknown[] = []
    const commitBuiltInOwnership = vi.fn(() => order.push('built-in'))
    const commitResolutionFailure = createRendererResolutionFailureHandoff({
      reportDiagnostic: (diagnostic) => {
        reported.push(diagnostic)
        order.push('diagnostic')
      },
      commitBuiltInOwnership,
    })
    const outcome = {
      status: 'not-found',
      candidate: 'MissingRenderer',
    } as const

    commitResolutionFailure(outcome)
    commitResolutionFailure(outcome)

    expect(order).toEqual(['diagnostic', 'built-in'])
    expect(reported).toHaveLength(1)
    expect(collectSemanticValues(reported[0])).toEqual(expect.arrayContaining([
      'resolution-failed',
      'MissingRenderer',
      'not-found',
    ]))
    expect(commitBuiltInOwnership).toHaveBeenCalledOnce()
  })

  it('preserves the original load failure context in the semantic diagnostic', () => {
    const failure = new Error('chunk unavailable')
    const reported: unknown[] = []
    const commitResolutionFailure = createRendererResolutionFailureHandoff({
      reportDiagnostic: diagnostic => reported.push(diagnostic),
      commitBuiltInOwnership: vi.fn(),
    })

    commitResolutionFailure({
      status: 'load-failed',
      candidate: 'BrokenRenderer',
      error: failure,
    })

    expect(reported).toHaveLength(1)
    expect(collectSemanticValues(reported[0])).toEqual(expect.arrayContaining([
      'resolution-failed',
      'BrokenRenderer',
      'load-failed',
      failure,
    ]))
  })

  it('gives an independent later selection attempt its own one-shot commit', () => {
    const order: string[] = []
    const dependencies = {
      reportDiagnostic: () => order.push('diagnostic'),
      commitBuiltInOwnership: () => order.push('built-in'),
    }
    const firstAttempt = createRendererResolutionFailureHandoff(dependencies)
    const laterAttempt = createRendererResolutionFailureHandoff(dependencies)
    const outcome = {
      status: 'not-found',
      candidate: 'MissingRenderer',
    } as const

    firstAttempt(outcome)
    firstAttempt(outcome)
    laterAttempt(outcome)
    laterAttempt(outcome)

    expect(order).toEqual([
      'diagnostic',
      'built-in',
      'diagnostic',
      'built-in',
    ])
  })

  it('exposes discriminated outcome types to the Mermaid entry', () => {
    expectTypeOf<Extract<RendererSelectionOutcome, { status: 'resolved' }>['component']>()
      .toEqualTypeOf<Component>()
    expectTypeOf<Extract<RendererSelectionOutcome, { status: 'load-failed' }>['error']>()
      .toEqualTypeOf<unknown>()
  })
})
