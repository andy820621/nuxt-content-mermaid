---
status: accepted
---

# Remove the `mermaidContent` alias in v3

Version 3 supports only `contentMermaid`: public types and runtime consumers no longer expose, mirror, or fall back to `mermaidContent`. Nuxt module setup still detects the removed key and fails with a migration error instead of silently applying defaults, preventing an invalid legacy configuration from appearing to work with different behavior.
