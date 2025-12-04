---
title: Flowchart - node shapes
type: flowchart
variant: shapes
config:
  htmlLabels: true
expect: Shape keywords render distinct silhouettes and labels stay legible.
notes:
  - Covers rectangle, rounded, circle, diamond, stadium, database, subroutine, and IO parallelograms.
  - Swap labels freely to test mixed languages.
---

```mermaid
graph LR
  start([Stadium start]) --> input[/User input/]
  input --> rect[Rect box]
  rect --> rounded(Rounded step)
  rounded --> decision{Valid?}
  decision -->|Yes| db[(Database)]
  decision -->|No| subroutine[[Subroutine]]
  db --> circle((Circle))
  subroutine --> output[\Output report\]
  circle --> done([Stop])
  output --> done
```
