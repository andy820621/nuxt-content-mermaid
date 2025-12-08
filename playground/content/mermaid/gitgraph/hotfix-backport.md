---
title: GitGraph - hotfix backport
type: gitgraph
variant: hotfix
tags:
  - gitGraph
  - hotfix
  - backport
config:
  gitGraph:
    diagramPadding: 16
    mainBranchName: main
    showCommitLabel: true
    showBranches: true
    rotateCommitLabel: false
    parallelCommits: true
expect: Illustrates a hotfix branched from main, merged to main and develop, with tags before and after.
notes:
  - Keeps rotateCommitLabel false to see default label orientation.
  - Good for checking branch rendering when backporting fixes.
---

```mermaid
gitGraph
  commit id:"init"
  branch develop
  commit id:"feat-A"
  commit id:"feat-B"

  checkout main
  merge develop id:"release-1.0"
  commit id:"v1.0.0" tag:"v1.0.0"

  branch hotfix/critical
  commit id:"fix-null"

  checkout main
  merge hotfix/critical id:"main-hotfix"
  commit id:"v1.0.1" tag:"v1.0.1"

  checkout develop
  merge hotfix/critical id:"backport-hotfix"

  branch feature/cleanup
  checkout feature/cleanup
  commit id:"linting"
  checkout develop
  merge feature/cleanup id:"cleanup-merge"
```
