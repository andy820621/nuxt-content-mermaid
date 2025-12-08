---
title: Pie - label position and decimals
type: pie
variant: text-position
tags:
  - pie
  - textPosition
  - decimals
config:
  pie:
    textPosition: 0.55
expect: Tests textPosition config, decimal values, and hand-drawn look keeping labels legible when pulled inward.
notes:
  - Uses showData with values up to two decimals.
  - Long labels should not overflow the circle edge.
---

```mermaid
%%{init: {"pie": {"textPosition": 0.55}}}%%
pie showData title Launch vehicle propellant mix
  "Liquid oxygen" : 52.5
  "RP-1 kerosene" : 31.25
  "Helium pressurization" : 4.25
  "Thermal conditioning overhead" : 12
```
