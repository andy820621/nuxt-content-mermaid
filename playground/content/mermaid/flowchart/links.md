---
title: Flowchart - link types
type: flowchart
variant: edge-styles
config:
  htmlLabels: true
expect: Solid, open, dotted, thick, bidirectional, and fan-out links all render with their labels.
notes:
  - Focuses on edge syntax; tweak text to see wrapping on labels.
  - Fan-out uses condensed syntax A --> B & C & D.
---

```mermaid
graph TD
  Start([Start]) --> Solid[Solid arrow]
  Start --- Open[Open link]
  Start -.-> Dotted[Dotted arrow]
  Start ==>|Bold| Thick[Thick arrow]
  Solid -- "Inline label" --> Labeled[Labeled edge]
  Dotted o--o Circle[Circle edge]
  Thick x--x Cross[Cross edge]
  Labeled <-->|Both ways| Bi[Bidirectional link]
  Fanout[Fan out] --> B[Branch B] & C[Branch C] & D[Branch D]
```
