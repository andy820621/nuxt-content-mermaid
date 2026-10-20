---
title: Use Case Diagram - basic
type: usecase
variant: actor-and-boundary
tags:
  - usecase-beta
  - actor
  - system-boundary
config:
  layout: dagre
expect: One actor connects to three use cases grouped inside an "Order system" boundary.
notes:
  - Use case diagrams are new in Mermaid 12 and use its new parser, which relies on Object.groupBy.
  - Use this page to verify that the module renders the beta syntax without an error block.
---

```mermaid
usecase-beta
direction LR
actor Customer("Customer")
systemBoundary "Order system"
  Browse("Browse catalog")
  Checkout("Place order")
  Track("Track delivery")
end
Customer --> Browse
Customer --> Checkout
Customer --> Track
```
