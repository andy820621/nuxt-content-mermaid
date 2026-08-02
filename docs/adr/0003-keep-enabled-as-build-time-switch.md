---
status: accepted
---

# Keep `contentMermaid.enabled` as a build-time switch

Version 3 keeps `contentMermaid: { enabled: false }` as the cross-Nuxt 3/4 Module Activation mechanism while Nuxt Content still supports Nuxt 3. `enabled` is excluded from Runtime Mermaid Options and `runtimeConfig.public.contentMermaid`; replacing it with Nuxt 4.3's native `contentMermaid: false` syntax is deferred until Nuxt Content drops Nuxt 3 and this package requires Nuxt 4.3 or newer. Any future need to stop rendering dynamically will receive a separate runtime option with explicit semantics.
