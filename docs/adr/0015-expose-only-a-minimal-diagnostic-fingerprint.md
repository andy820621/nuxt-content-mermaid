---
status: accepted
---

# Expose only a minimal diagnostic fingerprint

In 3.0, a package-originated Content Mermaid Configuration Error publicly guarantees only `name === "ContentMermaidConfigurationError"`, `code === "CONTENT_MERMAID_CONFIGURATION_ERROR"`, and a human-readable `message`. Every issue actually listed in that message includes its complete unambiguous formatted configuration path, and a truncated issue set makes the message explicitly state that additional problems were not listed.

Exact message wording, punctuation, and issue order are not public guarantees, nor are `instanceof` behavior or preservation of custom fields after Nuxt or Nitro serializes the error. The fingerprint applies only where the package originally throws the error; internal `phase`, `issues`, `truncated`, issue-code union, path ordering, and formatting behavior remain stable package test contracts but are not exported from the package entry, leaving room for a separately versioned diagnostic interface if a concrete CI or Nuxt error-hook consumer emerges.
