---
status: accepted
---

# Fail fast without a runtime configuration fallback

If raw Runtime Mermaid Options or the resolver's final result fails validation, the Universal Runtime Adapter throws a configuration error and publishes no Runtime Mermaid Snapshot. It does not fall back to package defaults, remove invalid fields, create a partially valid snapshot, retry automatically, or reinterpret the failure as a diagram render error; SSR stops that application/render context, while a client-only application stops that initialization attempt.

This policy is described as **fail-fast with no fallback**, not fail-closed: the purpose is to surface a broken configuration contract at its source rather than to enforce an authorization or security boundary. A final-result failure is treated just as strictly because it indicates an invalid package default or resolver defect that must not be hidden behind different runtime behavior.
