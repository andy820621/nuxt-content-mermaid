---
title: User Journey - mobile food order
type: userJourney
variant: mobile-ordering
tags:
  - journey
  - satisfaction
config:
  journey:
    useMaxWidth: false
    leftMargin: 81
    diagramMarginX: 16
    diagramMarginY: 16
    taskMargin: 24
    actorColours: ["#0ea5e9", "#22c55e"]
    sectionColours: ["#fef3c7", "#e0f2fe", "#f0f9ff"]
expect: Maps a two-actor flow (customer + kitchen) with varying satisfaction scores across discovery, selection, payment, and fulfillment.
notes:
  - Uses actorColours/sectionColours to differentiate swimlanes without touching theme.
  - Satisfaction scores mix highs and lows to check rendering of gradients.
---

```mermaid
journey
  title Mobile food ordering journey
  section Discover
    See promo push            : 3: customer
    Open app homepage         : 4: customer
    Update daily specials     : 2: kitchen
  section Select
    Browse menu               : 4: customer
    Apply dietary filter      : 3: customer
    Mark sold-out items       : 2: kitchen
  section Pay
    Checkout with Apple Pay   : 5: customer
    Confirm order ticket      : 3: kitchen
  section Fulfill
    Prepare order             : 4: kitchen
    Pickup ready notification : 5: customer
```
