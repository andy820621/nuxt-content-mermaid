---
status: accepted
---

# Snapshot runtime options per Nuxt application

`runtimeConfig.public.contentMermaid` is a Nuxt and Nitro transport interface rather than a live package control plane. A Universal Runtime Adapter runs for each Nuxt application instance, starts from the public payload actually received after Nuxt and Nitro processing, validates that raw payload, resolves runtime package defaults and domain shorthands, validates the final result, and only then recursively freezes and exposes a `DeepReadonly<ResolvedRuntimeOptions>` Runtime Mermaid Snapshot; runtime deep-freeze is always enabled with identical development and production semantics. The adapter does not resolve Module Activation, include `enabled`, or rerun Nuxt module option resolution.

Before freezing, the resolver constructs a fully package-owned pure-data graph: no reactive proxy, plain object, or array from either the transport payload or package defaults is retained at any depth, so freezing cannot cross the package boundary or change an input. Input reference identity is not part of the result contract. SSR state is confined to its Nuxt application and render context, the browser creates one snapshot per Nuxt application, and no process-global snapshot is allowed; the Mermaid loader and Built-in Renderer consume only this shared app-scoped seam instead of reading public runtime config independently or importing build-side `ModuleOptions`.

Every call to `mermaid.initialize()` or Mermaid rendering receives a newly materialized Mermaid Config Working Copy. Structural data from the snapshot, package defaults, and transport payload is detached from every previous or concurrent invocation; Direct Mermaid Config additionally follows its explicit Opaque Mermaid Capability rules. A component-level computed value is not an invocation boundary and therefore cannot be reused as the mutable object passed to Mermaid.

README describes runtime overrides as inputs resolved during application initialization. Mutating public runtime config afterward is not guaranteed to affect the package; any future reactive configuration seam must separately define Mermaid reinitialization and diagram rerendering semantics instead of changing the snapshot contract.
