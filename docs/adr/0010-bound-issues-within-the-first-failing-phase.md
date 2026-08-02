---
status: accepted
---

# Bound issues within the first failing validation phase

Fail-fast means stopping at the first failing Configuration Validation Phase, not stopping after its first issue. Within that phase the validator collects every safe, non-speculative issue it can observe up to a fixed limit of 50, then throws one configuration error; if an accessor, cycle, or invalid container prevents safe descent, it reports the current path, stops only that branch, and continues with safe sibling branches. Any issue prevents merge, shorthand resolution, and all later validation phases, which avoids duplicated and cascading diagnostics.

On collecting the fiftieth issue, traversal stops and the result sets `truncated: true`; fewer issues produce `truncated: false`. Traversal is deterministic so the selected bounded set is stable, and returned issues are stably sorted first by path and then by code. Cycle detection uses only the current ancestor chain: a non-cyclic shared reference is traversed and validated independently at every reachable path rather than being mistaken for a cycle or relying on shared identity.
