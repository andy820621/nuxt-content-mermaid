# Dependency and Migration Contract for 4.x

> **Upcoming 4.x contract; 4.0 is not yet published.** The current npm release is
> 3.0.5 with Mermaid 11. This contract takes effect for Package Users who upgrade
> to 4.x after publication.

This is the public Compatibility Contract for Package Users of
`@barzhsieh/nuxt-content-mermaid` 4.x. The [3.x contract](./DEPENDENCY_AND_MIGRATION_CONTRACT.md)
remains a historical contract; the [v4 migration guide](./MIGRATION_V4.md) explains the changes.

## Dependency and browser boundary

Use Node.js `>=22.19.0`, `nuxt@^4.1.0`, and `@nuxt/content@>=3.5.0 <4.0.0`.
These host requirements are unchanged from 3.x. Nuxt and Content remain
Package User-owned peers: every non-prerelease version within the declared
ranges is a Declared-Compatible Combination. A new peer major requires explicit
verification and a later package release.

Mermaid is a Module-Owned Dependency, bundled as `mermaid@~12.2.0`. Do not install
Mermaid solely for this module. Fresh installs may take Mermaid 12.2 patches;
new upstream minors or majors require an explicit package update. Compatibility
does not certify that every compatible upstream version is secure. Keep the
application's lockfile and security tooling current and use patched host releases.

The browser baseline is ES2024 / Safari 17.4+, including iOS / iPadOS 17.4+,
following the [fixed Mermaid 12.2 requirements](https://github.com/mermaid-js/mermaid/blob/1fb7869866dd619168d840291c9c54b4f129758b/packages/mermaid/src/docs/config/usage.md#L27-L33).
4.x declares this package's browser floor explicitly for the first time. 3.x did
not state a Safari minimum or guarantee every older browser; the increase is in
Mermaid's upstream requirements from 11 to 12.
Older browsers are outside this contract. Transpilation does not supply APIs
such as `Object.groupBy`; applications choosing older environments own and
verify the necessary transforms / polyfills. Current Playwright engine evidence
is not verification of real Safari 17.4 or physical iOS devices.

## Configuration and migration boundary

The module defaults to `layout: 'dagre'` and `look: 'classic'`; Package Users can
override both. The default/dark theme policy and the existing Runtime, Page,
and Direct Mermaid Config transport, validation, merge, and isolation semantics
remain in force. Page and Direct configuration remain mutually exclusive.

Mermaid 12 removes `flowchart.defaultRenderer`, `class.defaultRenderer`, and
`state.defaultRenderer` from its public types. Object literals can produce
TS2353. Select top-level `layout: 'dagre'` or `layout: 'elk'` at the required
scope: runtime initialization is an application-wide default, Page config covers
supporting diagrams on the page, and Direct config covers that component instance.
Moving a diagram-specific key to top-level layout can therefore affect other
supporting diagram types. The migration guide shows single-diagram choices.
Runtime transport preserves these Mermaid-owned keys, but the
engine ignores them. Development warns once per source × field per page load;
production removes that warning. There is no automatic conversion or type shim.

An application using `^3.x` does not receive 4.x or Mermaid 12 automatically.
Opt into 4.x and follow the migration guide. Public type narrowing requires this
major, which also adopts the new explicit browser floor; geometry does not
determine the bump.

## Package-owned rendering behavior

If the bundled engine successfully renders source, the Built-in Renderer
commits the usable SVG under the transactional rendering contract. If Mermaid
loading or rendering fails, package-owned error and fallback semantics apply.
Documented Nuxt / Content activation, Markdown transformation, configuration
transport, public types, themes, toolbar, lazy rendering, and extension or styling
hooks retain their documented semantics except for the migrations above.

The contract excludes Mermaid input acceptance, exact SVG serialization or
element order, undocumented DOM / classes / generated identifiers, layout,
geometry, coordinates, dimensions, font measurement, Mermaid internals, and
exhaustive diagram-feature correctness. Control the application lockfile,
browser, fonts, and viewport when maintaining visual snapshots. Error-source
CSS visibility is tracked separately in [#145](https://github.com/andy820621/nuxt-content-mermaid/issues/145).

## 3.x Frozen Policy

When 4.0 publishes, 3.x becomes a Frozen Legacy Release for Nuxt 4. Existing npm
versions remain installable and are not automatically deprecated, but the line
receives no dependency updates, compatibility expansion, new features, or ordinary fixes.

The first three months after 4.0 form a Migration Assistance Window for
documentation, usage guidance, and 4.x defects that prevent migration. A low-risk
backport for a package-caused critical security issue may be considered
individually without reopening ordinary 3.x maintenance. Evidence of substantial
3.x demand may justify extending assistance, but no extension is promised in advance.
