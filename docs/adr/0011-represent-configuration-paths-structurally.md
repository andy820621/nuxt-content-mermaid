---
status: accepted
---

# Represent configuration paths structurally

Each Configuration Issue stores only a canonical relative `readonly (string | number)[]` path together with `code`, `expected`, and a received category. The containing `ContentMermaidConfigurationError` stores the single failing phase, ordered issues, and `truncated` flag once, preventing redundant phase data and impossible states where issues claim different phases; neither representation retains the invalid setting value.

Issue ordering compares path segments directly and lexicographically: numbers use numeric order, strings use fixed JavaScript code-unit order, a shorter common-prefix path sorts first, and an otherwise necessary mixed-type tie-break places numbers before strings; equal paths sort by code using the same fixed code-unit order. Ordering never depends on a display formatter, so `[2]` precedes `[10]` and wording changes cannot alter diagnostic or test order.

Human-readable paths are derived by combining the phase's root with the relative segments. String keys matching the ASCII identifier form `[A-Za-z_$][A-Za-z0-9_$]*` use dot notation, all other strings use bracket notation with JSON escaping, and numeric segments use array-index notation. A symbol key is reported at its containing object's path with a symbol-key issue and no invented segment because symbols are not addressable in the JSON transport structure.
