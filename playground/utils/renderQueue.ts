let renderQueue = Promise.resolve()

export function enqueueRender(task: () => Promise<void>): Promise<void> {
  renderQueue = renderQueue.then(task).catch((e) => {
    console.error('[MyMermaid] Render error:', e)
  })
  return renderQueue
}
