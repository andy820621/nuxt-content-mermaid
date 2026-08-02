---
status: accepted
---

# Materialize direct Mermaid configuration per invocation

Direct Mermaid Config is converted for each `mermaid.initialize()` or render call by the named `materializeDirectMermaidConfigForInvocation()` seam, not by a generic deep-clone utility. Plain objects and arrays are recursively copied into package-owned structural data with a fresh per-invocation memo so they share nothing with the input or another invocation while preserving each input's non-cyclic shared-reference relationships inside that one working copy; unsupported cycles and non-plain instances are rejected unless an explicit adapter exists.

`RegExp` values accepted at upstream-defined paths are recreated from `source` and `flags` with `lastIndex` preserved, and are rejected if they carry extra custom string or symbol properties. Values that upstream explicitly defines as non-reproducible capabilities retain identity only through a versioned, precise path allowlist—for example Mermaid font callbacks, DOMPurify callback fields, and `dompurifyConfig.TRUSTED_TYPES_POLICY`; these Opaque Mermaid Capabilities remain provider-owned and are not frozen, wrapped, cloned, or traversed, so their closure and attached state are outside working-copy isolation.

Open keys do not imply open capability types: every other non-plain instance is rejected until a path-specific adapter or capability rule is deliberately added. The allowlist and adapters are tested against the Mermaid and DOMPurify versions supported by the package, avoiding the false promise that arbitrary JavaScript values can be copied without changing their behavior.
