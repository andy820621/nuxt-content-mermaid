---
title: Pie - minimal syntax, no title
type: pie
variant: minimal
tags:
  - pie
  - syntax
config:
  theme: base
  fontFamily: "Fira Code, monospace"
  pie:
    textPosition: 0.82
expect: Shows the smallest valid pie definition using only the pie keyword and data rows, with a base theme and adjusted label radius.
notes:
  - Good for verifying default styling when showData and title are omitted.
  - Slice sizes stay proportionate even with uneven totals.
---

```mermaid
pie
  "Backend tasks" : 14
  "Frontend polish" : 9
  "Docs & demos" : 5
  "Bug triage" : 4
```
