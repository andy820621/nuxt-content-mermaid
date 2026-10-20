# Migration to v4

Version 4 bundles Mermaid `~12.2.0`. This is a major release because Mermaid's
public configuration types remove `defaultRenderer` and the supported browser
baseline rises to ES2024 / Safari 17.4+. Layout, geometry, and dimensions remain
outside the package's rendering contract.

Node.js `>=22.19.0`, Nuxt `^4.1.0`, and Nuxt Content `>=3.5.0 <4.0.0` are unchanged.
After 4.0 is published, install `@barzhsieh/nuxt-content-mermaid@^4` to opt in.
An application's `^3.x` range does **not** receive Mermaid 12 automatically.

## Replace defaultRenderer with layout

Remove `flowchart.defaultRenderer`, `class.defaultRenderer`, and
`state.defaultRenderer` from all three package configuration sources:

| Source | Where to update |
| --- | --- |
| Page Mermaid Config | The Markdown page's `config` frontmatter / `pageConfig` prop |
| Direct Mermaid Config | The component's `config` prop |
| Runtime Mermaid Config | `contentMermaid.loader.init` or its public runtime equivalent |

Use top-level `layout: 'dagre'` for the old `'dagre-wrapper'` value, or
`layout: 'elk'` for `'elk'`. Keep other diagram options in their existing object.

```yaml
# Before: Page Mermaid Config
config:
  flowchart:
    defaultRenderer: elk
    htmlLabels: false
```

```yaml
# After
config:
  layout: elk
  flowchart:
    htmlLabels: false
```

For Direct Mermaid Config:

```vue
<Mermaid :config="{ layout: 'elk' }" :code="code" />
```

For runtime defaults:

```ts
export default defineNuxtConfig({
  contentMermaid: {
    loader: { init: { layout: 'dagre', look: 'classic' } },
  },
})
```

Mermaid 12 silently ignores the old keys at runtime. This module preserves the
input and warns in development once per **source × field per page load**, even
with multiple diagrams or repeated renders. Production builds remove this
warning. No automatic conversion occurs; an old `'elk'` value alone no longer
selects ELK.

The module defaults to `layout: 'dagre'` and `look: 'classic'`. Package Users can
override either. The existing default/dark theme policy is unchanged. ELK is
loaded only when a diagram selects `layout: 'elk'`.

## Fix TS2353 in configuration literals

Mermaid 12's types reject the removed properties. For example,
`{ flowchart: { defaultRenderer: 'elk' } } satisfies PageMermaidConfig` produces
TS2353 (an unknown property). Replace it with
`{ layout: 'elk' } satisfies PageMermaidConfig`. Apply the same fix to Direct
Mermaid Config and `loader.init`; do not cast away the error as a migration.
The package does not add a compatibility type layer for the removed fields.

## Check reader browsers

Mermaid 12 targets ES2024 and Safari 17.4+, including iOS / iPadOS 17.4+
([upstream requirements](https://github.com/mermaid-js/mermaid/blob/1fb7869866dd619168d840291c9c54b4f129758b/packages/mermaid/src/docs/config/usage.md#L27-L33)).
iOS / iPadOS 17.4 shipped on [March 5, 2024](https://support.apple.com/en-us/HT214081);
macOS Safari 17.4 shipped on [March 7, 2024](https://support.apple.com/en-us/120894).
Readers staying on older systems may need an OS update to obtain a supported
Safari version. Older browsers fall outside this contract even if some diagrams work.

Syntax transforms and API polyfills solve different problems. Lowering a build
target does not supply missing APIs. In a production browser probe with
`Object.groupBy` removed, a flowchart rendered, but loading the usecase parser
failed. The module handled that failure as a diagram error; surrounding page
content and Vue interactions still worked. Injecting a lazy-module SyntaxError
also reached diagram error handling. These probes are not an emulation of an
older Safari, and cannot guarantee the whole application's compatibility.

Applications that require older browsers must supply and verify the necessary
transforms / polyfills themselves, or retain 3.x. Real Safari 17.4 and physical
iOS devices have not been verified. Source shown in an error slot may be clipped
by existing CSS; this separate limitation is tracked in [#145](https://github.com/andy820621/nuxt-content-mermaid/issues/145).

## Review diagram dimensions

Dagre/classic defaults preserve the intended rendering direction, but Mermaid
12 can change spacing, labels, SVG dimensions, and geometry. Review diagrams
inside constrained layouts and update application-owned visual snapshots.
Byte-identical SVG and geometry are not package compatibility guarantees.

## 3.x becomes frozen

On 4.0 publication, 3.x remains installable but receives no dependency updates,
compatibility expansion, features, or ordinary fixes. The first three months
prioritize migration documentation, guidance, and 4.x defects blocking migration.
Critical package-caused security backports are considered individually.
See the [4.x dependency and migration contract](./DEPENDENCY_AND_MIGRATION_CONTRACT_V4.md).
