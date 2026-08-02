---
status: accepted
---

# Classify component configuration errors separately

A package-originated Mermaid Component Configuration Error has the independent Minimal Public Diagnostic Fingerprint `name === "MermaidComponentConfigurationError"` and `code === "CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR"`. Component-prop misuse, global configuration failure, and Mermaid render failure remain separate classifications because they have different sources and remedies; the component error does not aggregate issues, enter the diagram error component, export a class or type, or guarantee `instanceof`, exact message text, or serialized custom fields.

One named component-source resolver owns the invariant throughout the component lifetime. Initial setup synchronously resolves the source before creating downstream watchers, Theme Resolution Policy, or render behavior. If both `pageConfig` and `config` have values initially, the resolver throws before validating or merging either value, and no recovery watcher is created.

Later reactive updates pass through the same resolver after Vue finishes the current update batch, and every theme or render consumer receives only its legal output. A still-invalid update enters one continuous Component Configuration Conflict, throws this error once for that conflict, rejects new Render Requests, and invalidates queued and executing Render Generations. If Vue error handling leaves the instance mounted, the first later legal state exits the conflict and requests exactly one render for the then-current source and configuration; intermediate states are not replayed. A remounted instance follows the initial-setup rule again.

The visible-diagram preservation promised by this recovery lifecycle depends on the Transactional Render invariant in ADR 0017. Without that renderer change, preservation is only best effort and is not part of the contract.

Future Built-in Renderer invocation invariants reuse this same error classification instead of adding a new public error fingerprint for each rule.
