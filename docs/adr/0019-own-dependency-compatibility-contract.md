---
status: accepted
---

# Own the dependency compatibility contract

nuxt-content-mermaid 3.x owns the compatibility contract it publishes instead of inheriting one transitively from Nuxt Content. Nuxt and Nuxt Content are Package User-provided, major-bounded peers whose future in-range releases are presumed compatible until evidence shows a Contract Gap; a new upstream major enters only through an explicit additive package release, while removing or narrowing existing support requires a new package major.

Mermaid remains a Module-Owned Dependency because it is the Built-in Renderer's engine rather than a host capability. Its published range is minor-bounded so compatible and security-related patches can flow without making the individual maintainer a mandatory patch-release gate, while a new Mermaid minor or major requires an explicit range update and package release. The Nuxt Toolchain Family is coordinated with the Nuxt baseline but does not become another public compatibility dimension.

This deliberately trades perfect install-time immutability for proportionate maintenance: fixed compatibility profiles provide reproducible evidence, but they are not support-range ceilings. Exact floors, release baselines, verification scope, security guidance, and legacy-release policy belong to the 3.x dependency version strategy specification.

