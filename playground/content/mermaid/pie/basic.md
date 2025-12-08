---
title: Pie - daily caffeine mix
type: pie
variant: showdata-basics
tags:
  - pie
  - showData
config:
  theme: neutral
  pie:
    textPosition: 0.72
expect: Validates basic pie syntax with title + showData and straightforward positive numbers.
notes:
  - Order of slices follows the declaration to check clockwise rendering.
  - Quick sanity check for module rendering of pie charts.
---

```mermaid
pie showData title Daily caffeine sources
  "Espresso shots" : 30
  "Pour over" : 18
  "Cold brew" : 22
  "Tea" : 17
  "Energy drinks" : 13
```
