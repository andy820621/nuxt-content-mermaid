// Preserve this Custom Renderer example's cross-instance ordering without
// coupling it to the module's Built-in Renderer factory.
let customRendererTail = Promise.resolve()

export function serializeCustomMermaidRender(render: () => Promise<void>): Promise<void> {
  customRendererTail = customRendererTail.then(render).catch((error) => {
    console.error('[MyMermaid] Render error:', error)
  })
  return customRendererTail
}
