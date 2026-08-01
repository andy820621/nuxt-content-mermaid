---
status: accepted
---

# Preserve public Mermaid instance access

The Built-in Renderer will be deepened behind an internal render seam, while the public `$mermaid: () => Promise<Mermaid>` injection retains its existing type and observable loading, caching, initialization, and error behavior to preserve the Compatibility Contract. We accept that a Package User can mutate the shared Mermaid instance and interfere with rendering; replacing that access with an isolated render interface would require a separately planned breaking change.
