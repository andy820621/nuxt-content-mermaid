---
title: GitGraph - feature train to release
type: gitgraph
variant: feature-train
tags:
  - gitGraph
  - branches
  - merge
config:
  gitGraph:
    titleTopMargin: 20
    diagramPadding: 14
    mainBranchName: main
    mainBranchOrder: 1
    showCommitLabel: true
    rotateCommitLabel: true
    parallelCommits: true
    nodeLabel:
      width: 92
      height: 22
      y: -8
expect: Shows a feature flow branching off develop, merging multiple feature branches, and tagging a release.
notes:
  - Uses rotateCommitLabel to keep labels readable when branches are dense.
  - Demonstrates parallel feature branches merging back before a release tag.
---

```mermaid
gitGraph
  commit id:"init"
  branch develop
  checkout develop
  commit id:"ci-setup"
  branch feature/login
  checkout feature/login
  commit id:"login-ui"
  commit id:"login-auth"
  checkout develop
  merge feature/login id:"merge-login"

  branch feature/metrics
  checkout feature/metrics
  commit id:"metrics-dash"
  commit id:"metrics-api"
  checkout develop
  merge feature/metrics id:"merge-metrics"

  checkout main
  merge develop id:"prep-release"
  commit id:"v1.0.0" tag:"v1.0.0"
```
