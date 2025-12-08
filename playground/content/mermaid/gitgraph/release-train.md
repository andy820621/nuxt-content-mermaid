---
title: GitGraph - dual-track release train
type: gitgraph
variant: release-train
tags:
  - gitGraph
  - release
  - parallel
config:
  gitGraph:
    titleTopMargin: 18
    diagramPadding: 12
    mainBranchName: main
    mainBranchOrder: 1
    showCommitLabel: true
    rotateCommitLabel: true
    parallelCommits: true
    nodeLabel:
      width: 100
      height: 22
      y: -10
expect: Shows a dual-track release with API and web branches merging into a release branch, then back to main with tags.
notes:
  - Parallel branches are merged sequentially into the release branch to check ordering.
  - Commit labels rotated to reduce overlap near merge points.
---

```mermaid
gitGraph
  commit id:"seed"
  branch release/2.0
  checkout release/2.0
  commit id:"rc1"

  branch feature/web
  checkout feature/web
  commit id:"web-ui"
  commit id:"web-a11y"

  branch feature/api
  checkout feature/api
  commit id:"api-schema"
  commit id:"api-throttle"

  checkout release/2.0
  merge feature/api id:"merge-api"
  merge feature/web id:"merge-web"

  checkout main
  merge release/2.0 id:"ga-2.0"
  commit id:"v2.0.0" tag:"v2.0.0"
```
