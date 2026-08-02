---
status: accepted
---

# Commit only the latest legal render generation

The Built-in Renderer adopts Transactional Render as the prerequisite for reactive component-configuration recovery. Every Render Request belongs to a component-scoped Render Generation, and generation invalidation uses logical cancellation: only the latest legal generation may commit package-managed live DOM or state. A stale request that has not started may be skipped, while Mermaid work already in progress may finish in its isolated staging target but its result must be discarded. The public interface does not promise `AbortSignal`, immediate interruption, or a fixed FIFO implementation.

Initial setup remains fail-fast: if both `pageConfig` and `config` are provided, the component synchronously throws a Mermaid Component Configuration Error before creating any recovery watcher, Theme Resolution Policy, or render flow. Later prop updates are validated after Vue completes the same update batch. A conflict that remains at that boundary enters one conflict episode and throws once; repeated observations during the same uninterrupted conflict do not throw again.

Each built-in Render Attempt completes inside its own Staging Render Target, isolated from the live Render Target. Its result is committed to the live Render Target in one step only when Mermaid rendering succeeded, its generation is still the latest generation, and component configuration is still legal. Otherwise the staging result is discarded. A failed, stale, or conflict-invalidated attempt therefore cannot clear or partly overwrite the latest Committed Diagram.

Isolation from the live Render Target, rather than `Node.isConnected === false`, is the required property. Mermaid 11.12.3 cannot render even a basic flowchart in a truly disconnected node because its layout path queries connected DOM geometry, while the same render succeeds in a package-owned offscreen measurement host for both `strict` and `sandbox` security levels. The implementation may therefore connect staging DOM outside the live render subtree for measurement, must remove it after the attempt, and must never expose it as the Committed Diagram.

If Vue error handling leaves the component instance mounted and its props later become legal, the resolver exits the conflict and enqueues exactly one Render Request for the then-current source and resolved configuration. It does not replay intermediate conflict states. If the instance was unmounted, only a later mount establishes new behavior.

This contract requires replacing the current live-target mutation and failure cleanup behavior. Until that work is complete, the implementation may offer only best-effort preservation and documentation must not promise that the last successful diagram DOM is retained.

The earlier renderer factory and migration documents deliberately excluded cancellation, deduplication, and coalescing from their narrower implementation slices. Those exclusions remain historical context but are superseded wherever they conflict with logical generation invalidation and transactional commit required here. Queue organization and wasted-work reduction remain internal choices so long as they preserve the observable latest-legal-commit invariant.
