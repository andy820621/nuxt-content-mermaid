---
title: Flowchart - HTML code label
type: flowchart
variant: html-code-label
tags:
  - flowchart
  - html-labels
config:
  htmlLabels: true
expect: The first node shows `call render()` with `render()` in inline code, readable after rendering.
notes:
  - The renderer hides only the SSR source that waits for rendering, so `<code>` inside a rendered HTML label stays visible.
---

```mermaid
flowchart LR
  Call["call <code>render()</code>"] --> Done[Done]
```
