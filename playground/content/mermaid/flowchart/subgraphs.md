---
title: Flowchart - subgraphs
type: flowchart
variant: subgraph-groups
config:
  htmlLabels: true
  flowchart:
    curve: basis
expect: Subgraphs visually grouped; edges flow smoothly between groups.
notes:
  - Placeholder nodes; swap in your own steps later.
  - Keep one cross-link to test arrow routing.
---

```mermaid
graph LR
  subgraph API
    A[Auth] --> B[Fetch]
  end
  subgraph UI
    C[Render list] --> D[Handle click]
  end
  A --> C
  B --> D
  D --> B
```
