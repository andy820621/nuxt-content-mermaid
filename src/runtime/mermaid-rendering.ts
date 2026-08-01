import type { Mermaid, MermaidConfig } from 'mermaid'
import { nextTick } from 'vue'
import { MERMAID_LOG_PREFIX } from './constants'

let renderQueue = Promise.resolve()
let queueSize = 0

export interface MermaidRenderData {
  source: string | null | undefined
  config: MermaidConfig
  target: HTMLDivElement | null | undefined
}

export type MermaidRenderOutcome
  = | { status: 'skipped' }
    | { status: 'success' }
    | { status: 'failure', error: unknown }

export interface MermaidRendererDependencies {
  loadMermaid: () => Promise<Mermaid>
  readRenderData: () => MermaidRenderData
  prepare: () => void
  debug: boolean
}

/** @internal */
export function createMermaidRenderer(
  dependencies: MermaidRendererDependencies,
): () => Promise<MermaidRenderOutcome> {
  if (dependencies.debug) {
    console.log(MERMAID_LOG_PREFIX, {
      event: 'renderer:create',
    })
  }

  return () => {
    queueSize++
    if (dependencies.debug) {
      console.log(MERMAID_LOG_PREFIX, {
        event: 'queue:enqueue',
        queueSize,
      })
    }

    const render = async (): Promise<MermaidRenderOutcome> => {
      let target: HTMLDivElement | null | undefined
      let attemptStart: number | undefined

      if (dependencies.debug) {
        console.log(MERMAID_LOG_PREFIX, {
          event: 'queue:start',
          pending: queueSize - 1,
        })
      }

      try {
        const renderData = dependencies.readRenderData()
        const { source, config } = renderData
        target = renderData.target

        if (!source || !target)
          return { status: 'skipped' }

        if (dependencies.debug)
          attemptStart = performance.now()

        dependencies.prepare()

        const mermaid = await dependencies.loadMermaid()
        mermaid.initialize(config)
        target.removeAttribute('data-processed')
        target.textContent = source
        await nextTick()

        await mermaid.run({
          nodes: [target],
          suppressErrors: !dependencies.debug,
        })

        const svg = target.querySelector('svg')
        if (svg)
          ensureViewBox(svg)

        return { status: 'success' }
      }
      catch (error) {
        if (target) {
          try {
            target.innerHTML = ''
          }
          catch {
            // Preserve the original failure when cleanup itself cannot complete.
          }
        }

        if (dependencies.debug) {
          console.error(
            MERMAID_LOG_PREFIX,
            { event: 'attempt:failure' },
            error,
          )
        }

        return { status: 'failure', error }
      }
      finally {
        if (dependencies.debug && attemptStart !== undefined) {
          console.log(MERMAID_LOG_PREFIX, {
            event: 'attempt:duration',
            duration: performance.now() - attemptStart,
          })
        }

        queueSize--
        if (dependencies.debug) {
          console.log(MERMAID_LOG_PREFIX, {
            event: 'queue:finish',
            remaining: queueSize,
          })
        }
      }
    }

    const outcome = renderQueue.then(render)
    renderQueue = outcome.then(
      () => undefined,
      () => undefined,
    )
    return outcome
  }
}

function ensureViewBox(svg: SVGSVGElement) {
  if (svg.hasAttribute('viewBox'))
    return

  try {
    const bbox = (svg as SVGGraphicsElement).getBBox()
    if (bbox.width > 0 && bbox.height > 0)
      svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
  }
  catch {
    // Some rendered SVGs cannot provide a bounding box in the current DOM.
  }
}
