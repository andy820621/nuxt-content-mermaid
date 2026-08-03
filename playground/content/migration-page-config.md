---
title: Content-generated Page Mermaid Config
type: Migration demo
expect: The Markdown Diagram Protocol passes this page's pure-data config to Mermaid as pageConfig.
config:
  theme: forest
---

# Content-generated Page Mermaid Config

This diagram starts as Markdown with page frontmatter. Nuxt Content parses the page and the Markdown Diagram Protocol supplies its `config` value as Page Mermaid Config.

```mermaid
---
toolbar:
  title: Page Mermaid Config
---
flowchart LR
  FRONTMATTER --> PAGE_CONFIG
```
