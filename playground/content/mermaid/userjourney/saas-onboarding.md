---
title: User Journey - SaaS onboarding friction
type: userJourney
variant: saas-onboarding
tags:
  - journey
  - onboarding
config:
  journey:
    useMaxWidth: false
    leftMargin: 81
    diagramMarginX: 16
    diagramMarginY: 16
    taskMargin: 24
    actorColours: ["#6366f1", "#f97316"]
    sectionColours: ["#eef2ff", "#fff7ed"]
expect: Highlights where a new user meets friction during SaaS onboarding vs. the support team’s touchpoints.
notes:
  - Combines low and high satisfaction to visualize pain points.
  - Support touchpoints are included to show multiple actors in each section.
---

```mermaid
journey
  title SaaS onboarding & support
  section Sign-up
    Landing page CTA          : 4: user
    Email verification        : 2: user
    Welcome trigger           : 3: support
  section Setup
    Create first project      : 3: user
    Invite teammates          : 2: user
    Send checklist email      : 4: support
  section Activate
    Connect third-party app   : 1: user
    Debug OAuth failure       : 2: support
    Celebrate first success   : 5: user
```
