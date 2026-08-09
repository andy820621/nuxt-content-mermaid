# Dependency and Migration Contract for 3.x

This document is the public contract for package users of
`@barzhsieh/nuxt-content-mermaid` 3.x. It defines what you provide, what the
package provides, what a 2.x migration means, and which rendering outcomes are
outside the contract.

## Dependency boundary

Use a Node.js runtime of `>=22.19.0` with `nuxt@^4.1.0` and
`@nuxt/content@>=3.5.0 <4.0.0`. These are the exact 3.x public requirements.

Nuxt and Nuxt Content are Package User-owned peer dependencies. Install and
update them in your application, and keep their lockfile and security tooling
current. Every non-prerelease version inside the published peer ranges is a
Declared-Compatible Combination; a future Nuxt or Nuxt Content major is not
supported until a later package release adds it.

Mermaid is a Module-Owned Dependency. The package bundles and resolves
`mermaid@~11.16.1`; do not add Mermaid solely to satisfy this module. The tilde
range can accept patched releases in Mermaid 11.16, while a Mermaid minor or
major needs an explicit package update.

Compatibility is not a Security Recommendation. An old Nuxt or Nuxt Content
version may remain within the peer range and still be unpatched or unsuitable
for production. Use maintained upstream releases and your application's
lockfile, Dependabot, and security tooling to make that decision.

## Moving from 2.x

When 3.0 is published, 2.x remains an installable **Frozen Legacy Release**
for Nuxt 3. It is not automatically deprecated. The frozen line receives no
dependency updates, compatibility expansion, features, or ordinary fixes.

The first three months after 3.0 are a **Migration Assistance Window**. During
that window, maintainers prioritize migration documentation, usage guidance,
and 3.x defects that prevent migration. It is not ordinary 2.x maintenance and
does not promise a backport. A low-risk backport for a package-caused critical
security issue may be considered individually, without reopening the 2.x line.

To move to 3.x, upgrade the application to the requirements above, install the
3.x package, rename every live `mermaidContent` option to `contentMermaid`, and
follow the detailed [v3 migration guide](./MIGRATION_V3.md). In particular,
keep `contentMermaid.enabled` in Nuxt configuration and use either Page Mermaid
Config or Direct Mermaid Config for each diagram, never both.

## Package-owned rendering behavior

The package guarantees its integration seams. If the bundled Mermaid engine
successfully renders diagram source, the Built-in Renderer commits the usable
SVG under the transactional rendering contract. If Mermaid fails, the
package-owned error and fallback semantics apply. Documented Nuxt and Content
activation, Markdown transformation, configuration transport, public types,
themes, toolbar, lazy rendering, and documented extension or styling hooks
retain their documented behavior.

This is not a guarantee that Mermaid accepts every input or that every Mermaid
diagram is correct. The contract also excludes exact SVG serialization or
element order, undocumented DOM, classes, generated identifiers, layout,
geometry, coordinates, dimensions, font measurement, Mermaid internals, and
exhaustive support for every Mermaid feature.

If you need stable visual snapshots, control your own dependency lockfile,
browser version, fonts, viewport, and relevant execution environment. Do not
treat exact Mermaid output as a public package guarantee.
