---
title: Flowchart - directions & curve families
type: flowchart
variant: orientations-curves
config:
  htmlLabels: true
  flowchart:
    curve: linear
expect: One page to compare TD/LR/BT/RL layouts and the main curve families (linear, monotone, step, smooth, bump).
notes:
  - First graph uses the frontmatter default (linear) without any %%{init}%% override.
  - Later graphs override the curve via %%{init}%% to compare different families.
  - Use short labels so shapes and arrow routing stay easy to read.
---

### Frontmatter default (linear, TD)

```mermaid
graph TD
  A[Form submit] --> B{Valid?}
  B -- Yes --> C[Persist]
  B -- No --> D[Show error]
  C --> E[Done]
  D --> F[Retry]
  F --> B
```

### Monotone family (monotoneX, LR)

```mermaid
%%{init: { 'flowchart': { 'curve': 'monotoneX' } }}%%
graph LR
  A[API call] --> B{Success?}
  B -- Yes --> C[Render data]
  B -- No --> D[Show toast]
  C --> E[Done]
  D --> F[Retry]
  F --> A
```

### Monotone family (monotoneY, BT)

```mermaid
%%{init: { 'flowchart': { 'curve': 'monotoneY' } }}%%
graph BT
  A[Save draft] --> B{Has changes?}
  B -- Yes --> C[Sync]
  B -- No --> D[Skip]
  C --> E[Complete]
  D --> E
```

### Step family (step, LR)

```mermaid
%%{init: { 'flowchart': { 'curve': 'step' } }}%%
graph LR
  A[Queue item] --> B{Picked up?}
  B -- Yes --> C[Process]
  B -- No --> D[Wait]
  C --> E[Done]
  D --> B
```

### Step family (stepBefore, LR)

```mermaid
%%{init: { 'flowchart': { 'curve': 'stepBefore' } }}%%
graph LR
  A[Request] --> B{Authorized?}
  B -- Yes --> C[Serve]
  B -- No --> D[Deny]
  C --> E[Log]
  D --> E
```

### Step family (stepAfter, LR)

```mermaid
%%{init: { 'flowchart': { 'curve': 'stepAfter' } }}%%
graph LR
  A[Completed] --> B[Review]
  B --> C{Approved?}
  C -- Yes --> D[Publish]
  C -- No --> E[Rework]
  E --> B
```

### Smooth family (basis, LR)

```mermaid
%%{init: { 'flowchart': { 'curve': 'basis' } }}%%
graph LR
  A[Sensor] --> B[Filter]
  B --> C[Aggregate]
  C --> D[Dashboard]
```

### Smooth family (cardinal, TD)

```mermaid
%%{init: { 'flowchart': { 'curve': 'cardinal' } }}%%
graph TD
  A[Inbound] --> B[Normalize]
  B --> C[Enrich]
  C --> D[Store]
```

### Smooth family (catmullRom, BT)

```mermaid
%%{init: { 'flowchart': { 'curve': 'catmullRom' } }}%%
graph BT
  A[Stage 1] --> B[Stage 2]
  B --> C[Stage 3]
  C --> D[Stage 4]
```

### Smooth family (natural, RL)

```mermaid
%%{init: { 'flowchart': { 'curve': 'natural' } }}%%
graph RL
  A[Archive] --> B[Compress]
  B --> C[Upload]
  C --> D[Verify]
```

### Bump family (bumpX, LR)

```mermaid
%%{init: { 'flowchart': { 'curve': 'bumpX' } }}%%
graph LR
  A[User] --> B[Edge]
  B --> C[Backend]
  C --> D[Store]
  D --> E[Metrics]
```

### Bump family (bumpY, TD)

```mermaid
%%{init: { 'flowchart': { 'curve': 'bumpY' } }}%%
graph TD
  A[Job created] --> B[Queued]
  B --> C[Running]
  C --> D[Finished]
  D --> E[Report]
```
