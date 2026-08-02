---
status: accepted
---

# Discriminate page and direct Mermaid configuration

The Built-in Renderer exposes two mutually exclusive configuration source props with different contracts. `pageConfig` carries Page Mermaid Config as an open-key but strict-pure-data Nuxt Content payload, while the existing `config` prop carries Direct Mermaid Config with complete Mermaid configuration capability, including path-allowlisted opaque capabilities, direct-config validation, and a fresh Mermaid Config Working Copy for each invocation; the Markdown Diagram Transform emits `<Mermaid :page-config="config" />` instead of routing Content data through `config`.

The props form a source discriminator, not two ordinary override layers. Their public TypeScript shape must make simultaneous use invalid, and a prop is considered supplied when its value is not `undefined`; when both have values, the mutual-exclusion error takes priority over validating either payload, no winner or precedence is defined, and Diagram Mermaid Config therefore resolves from Runtime Mermaid Config plus Page Mermaid Config, or Runtime Mermaid Config plus Direct Mermaid Config, but never a three-source mixture.
