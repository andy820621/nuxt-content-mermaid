---
status: accepted
---

# Transfer rendering ownership after custom renderer resolution

## Implementation staging

This ADR records the target ownership semantics for #44, which are delivered through ordered tickets rather than one atomic change. #45 introduces only the Renderer Selection outcome seam. #46 is deliberately a behavior-preserving extraction: candidate pending still mounts the legacy Built-in markup and lifecycle while guarding Built-in Mermaid Render Request creation and execution. #47 replaces that compatibility state with the no-owner neutral pending path described below, and #48 completes resolution-failure diagnostics and fallback ordering. Intermediate tickets must therefore satisfy their explicit compatibility constraints; #46 is not evidence that the final pending semantics are already implemented.

Setting `components.renderer` creates a Custom Renderer Candidate rather than immediately assigning Rendering Ownership. Without a candidate, the Built-in Renderer owns the instance. With a candidate, Renderer Selection enters a no-owner pending phase: it preserves neutral source content for SSR and hydration but does not instantiate or execute Built-in Renderer UI, lazy loading, error handling, or rendering.

Successful resolution atomically assigns ownership to the Custom Renderer, which receives only the established `code`, default slot, and `spinner` inputs and completely replaces Built-in behavior. Once assigned, ownership is not transferred because the Custom Renderer later fails to mount or render. A future seam that keeps package UI and lifecycle but replaces diagram generation must have a different name and responsibility.

If resolution ends in `not-found` or `load-failed`, Renderer Selection reports one internal semantic diagnostic for that failed handoff before assigning ownership to the Built-in Renderer. The diagnostic identifies the candidate and reason and is a package test seam, not an exported structured-diagnostics interface. A human-readable console diagnostic containing the package prefix, candidate, and reason is emitted independently of `debug`, but its exact wording is not guaranteed. `components.error` remains exclusive to Built-in Mermaid render failures.

This two-stage handoff preserves the existing availability-oriented fallback without confusing configured intent with resolved ownership. Fail-closed selection is rejected for 3.0 because no current safety or compliance requirement makes a Custom Renderer mandatory. Console method choice, internal names, event-object representation, component-loading mechanics, and test-helper shape remain implementation defaults so long as they preserve ordering, exactly-once reporting, and single-owner invariants.
