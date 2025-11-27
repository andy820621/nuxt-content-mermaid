let renderQueue = Promise.resolve()

export function enqueueRender(task: () => Promise<void>): Promise<void> {
  renderQueue = renderQueue.then(task).catch((e) => {
    console.error('[nuxt-content-mermaid] Render error:', e)
  })
  return renderQueue
}
