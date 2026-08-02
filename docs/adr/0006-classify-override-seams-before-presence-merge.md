---
status: accepted
---

# Classify override seams before applying presence merge

Every package-owned interface described as an override uses the same Property-Presence Merge algebra, but only after its named resolver has normalized and validated that interface's raw inputs. The shared `mergeByPresence(layers)` primitive consumes an explicit n-ary sequence from lowest to highest priority, never mutates inputs, and rejects prototype-pollution keys; it does not interpret YAML, boolean shorthands, `null`, or other domain meanings, and callers must not regroup layers because replacements across plain objects and other value types can make regrouping change the result.

Existing `defu` call sites are classified and replaced individually rather than mechanically: module resolution keeps Module Activation separate and prevents runtime public overrides from participating in `enabled`; `resolveDiagramMermaidConfig` resolves per-render Mermaid configuration; toolbar and Markdown metadata retain their own named resolvers; `resolveExpandOptions` interprets its boolean shorthand before using the shared merger; and Theme Resolution Policy remains independent. Every resolver validates each observable raw source and its final result, so preservation by the merger does not imply that a domain accepts `null` or any other structurally representable value; arrays replace rather than concatenate, explicit falsy values replace lower layers, and each interface retains its own precedence and validity rules.
