let renderQueue = Promise.resolve()
let queueSize = 0

export function enqueueRender(task: () => Promise<void>, debug = false): Promise<void> {
  queueSize++
  if (debug) {
    console.log(`[nuxt-content-mermaid] 🔵 Enqueueing task. Queue size: ${queueSize}`)
  }

  const wrappedTask = async () => {
    if (debug) {
      console.log(`[nuxt-content-mermaid] 🟢 Starting render task. Pending: ${queueSize - 1}`)
    }
    try {
      await task()
    }
    catch (e) {
      console.error('[nuxt-content-mermaid] Render error:', e)
      throw e
    }
    finally {
      queueSize--
      if (debug) {
        console.log(`[nuxt-content-mermaid] ✅ Task finished. Remaining: ${queueSize}`)
      }
    }
  }

  renderQueue = renderQueue.then(wrappedTask).catch((e) => {
    if (debug) {
      console.error('[nuxt-content-mermaid] ❌ Queue chain caught error:', e)
    }
  })

  return renderQueue
}
