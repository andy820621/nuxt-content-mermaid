---
title: Flowchart - ELK layout
type: flowchart
variant: elk-layout
tags:
  - flowchart
  - elk
  - layout
config:
  layout: elk
expect: A left-to-right flowchart with a branch and a back edge, laid out by the ELK engine bundled with Mermaid 12.
notes:
  - Top-level `layout: elk` loads Mermaid's lazy `elk-*` chunk on first render; check the network panel for the request.
  - The retry edge loops back to Validate, so the layout has to route a back edge around the forward path.
---

```mermaid
flowchart LR
  Request[Request] --> Validate{Valid?}
  Validate -->|Yes| Process[Process]
  Validate -->|No| Reject[Reject]
  Process --> Store[(Store)]
  Reject -->|Retry| Validate
  Store --> Done([Done])
```
