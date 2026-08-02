---
status: accepted
---

# Validate configuration by schema ownership

Validation follows schema ownership rather than applying one unknown-property policy everywhere. Objects created or interpreted by nuxt-content-mermaid are Closed Configuration Objects and reject unknown properties, including the module/runtime envelopes, loader and lazy wrappers, theme, components, expand, toolbar, and fence inline-attribute syntax; payloads delegated to Mermaid or Markdown are Open Configuration Payloads and accept unknown properties, including Mermaid configuration and Mermaid YAML frontmatter.

Open means preserved, not ignored or unvalidated: every unknown property and nested pure-data value survives cloning, Property-Presence Merge, Runtime Mermaid Snapshot creation, and Mermaid Config Working Copy creation. An open object may contain closed islands at explicit ownership boundaries—for example, Mermaid YAML frontmatter is open overall, its `config` subtree is Mermaid-owned and open, and its `toolbar` subtree is package-owned and closed; fence inline attributes are closed outside, then transition to an open `config` subtree or closed `toolbar` subtree.

The package validates fields it actually interprets inside an open Mermaid configuration, including the known types of `theme`, `logLevel`, and `suppressErrorRendering`, without duplicating Mermaid's complete schema. Strict pure-data validation applies at public runtime config, Nuxt Content, and Markdown transport seams; a future explicit client-only extension seam may define a broader contract separately, but transport payloads never gain function or arbitrary-JavaScript support merely because their keys are open.
