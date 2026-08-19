import type { Mermaid, MermaidConfig } from 'mermaid'
import { MERMAID_LOG_PREFIX } from './constants'

let renderQueue = Promise.resolve()
let queueSize = 0
let renderId = 0

export interface MermaidRenderData {
  source: string | null | undefined
  config: MermaidConfig
  target: HTMLDivElement | null | undefined
}

export type MermaidRenderOutcome
  = | { status: 'skipped' }
    | { status: 'stale' }
    | { status: 'success', source: string, config: MermaidConfig }
    | { status: 'failure', error: unknown }

export interface MermaidRendererDependencies {
  loadMermaid: () => Promise<Mermaid>
  readRenderData: () => MermaidRenderData
  beforeCommit: () => void
  debug: boolean
}

export interface MermaidRenderRequest {
  (): Promise<MermaidRenderOutcome>
  invalidate: () => void
}

/** @internal */
export function createMermaidRenderer(
  dependencies: MermaidRendererDependencies,
): MermaidRenderRequest {
  if (dependencies.debug) {
    console.log(MERMAID_LOG_PREFIX, {
      event: 'renderer:create',
    })
  }

  let latestGeneration = 0

  const request: MermaidRenderRequest = () => {
    const generation = ++latestGeneration
    queueSize++
    if (dependencies.debug) {
      console.log(MERMAID_LOG_PREFIX, {
        event: 'queue:enqueue',
        queueSize,
      })
    }

    const render = async (): Promise<MermaidRenderOutcome> => {
      let target: HTMLDivElement | null | undefined
      let stagingRoot: HTMLDivElement | undefined
      let attemptStart: number | undefined

      if (dependencies.debug) {
        console.log(MERMAID_LOG_PREFIX, {
          event: 'queue:start',
          pending: queueSize - 1,
        })
      }

      try {
        if (generation !== latestGeneration)
          return { status: 'stale' }

        const renderData = dependencies.readRenderData()
        const { source, config } = renderData
        target = renderData.target

        if (!source || !target)
          return { status: 'skipped' }

        if (dependencies.debug)
          attemptStart = performance.now()

        const mermaid = await dependencies.loadMermaid()
        mermaid.initialize(config)

        const staging = createStagingTarget(target.ownerDocument)
        stagingRoot = staging.root
        const result = await mermaid.render(
          `nuxt-content-mermaid-${++renderId}`,
          source,
          staging.target,
        )

        if (generation !== latestGeneration)
          return { status: 'stale' }

        staging.target.innerHTML = result.svg

        const svg = staging.target.querySelector('svg')
        if (svg)
          ensureViewBox(svg)

        result.bindFunctions?.(staging.target)

        if (generation !== latestGeneration)
          return { status: 'stale' }

        // The commit phase must not yield after this final eligibility check.
        dependencies.beforeCommit()
        target.replaceChildren(...staging.target.childNodes)

        return { status: 'success', source, config }
      }
      catch (error) {
        if (generation !== latestGeneration)
          return { status: 'stale' }

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
        if (stagingRoot)
          removeStagingRoot(stagingRoot)

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

    return enqueueMermaidOperation(render)
  }

  request.invalidate = () => {
    latestGeneration++
  }

  return request
}

function enqueueMermaidOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const outcome = renderQueue.then(operation)
  renderQueue = outcome.then(
    () => undefined,
    () => undefined,
  )
  return outcome
}

export interface MermaidDetachedRenderOptions {
  loadMermaid: () => Promise<Mermaid>
  source: string
  config: MermaidConfig
  document: Document
}

/** @internal */
export function renderDetachedMermaidSvg(
  options: MermaidDetachedRenderOptions,
): Promise<SVGSVGElement> {
  return enqueueMermaidOperation(async () => {
    const mermaid = await options.loadMermaid()
    mermaid.initialize(options.config)
    const staging = createStagingTarget(options.document)

    try {
      const result = await mermaid.render(
        'nuxt-content-mermaid-' + ++renderId,
        options.source,
        staging.target,
      )
      staging.target.innerHTML = result.svg
      const svg = staging.target.querySelector('svg')
      if (!svg)
        throw new Error('Portable Mermaid render did not produce an SVG')

      ensureViewBox(svg)
      return svg.cloneNode(true) as SVGSVGElement
    }
    finally {
      removeStagingRoot(staging.root)
    }
  })
}

function removeStagingRoot(root: HTMLDivElement) {
  const parent = root.parentNode
  try {
    root.remove()
  }
  catch {
    try {
      parent?.removeChild(root)
    }
    catch {
      // Cleanup must not replace the Render Outcome with a secondary DOM error.
    }
  }
}

function createStagingTarget(document: Document) {
  const root = document.createElement('div')
  const stagingTarget = document.createElement('div')

  root.setAttribute('aria-hidden', 'true')
  root.inert = true
  root.tabIndex = -1
  root.style.position = 'fixed'
  root.style.left = '-100000px'
  root.style.top = '0'
  root.style.opacity = '0'
  root.style.pointerEvents = 'none'
  root.style.zIndex = '-1'
  root.appendChild(stagingTarget)
  document.body.appendChild(root)

  return { root, target: stagingTarget }
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
