# Migrating to v3

Version 3 makes the configuration boundary explicit. Update your Nuxt configuration, then choose one configuration source for each diagram. The [playground migration page](../../playground/pages/migration.vue) exercises the supported paths.

## 1. Rename the module key

`contentMermaid` is the only supported Nuxt configuration key. `mermaidContent` does not fall back to the new key: Nuxt setup stops with the public configuration-error fingerprint so an accidental partial migration cannot appear to work.

The rename predates v3: `contentMermaid` was already the canonical key in 2.x, while `mermaidContent` remained as a compatibility alias. Version 3 removes that fallback path, so every remaining legacy key must be migrated explicitly.

```ts
// v2 — removed
export default defineNuxtConfig({
  mermaidContent: { debug: true },
})

// v3
export default defineNuxtConfig({
  contentMermaid: { debug: true },
})
```

## 2. Keep Module Activation at build time

`contentMermaid.enabled` is Module Activation. It decides whether the module installs its Markdown transform and runtime integration while Nuxt starts. Keep it in Nuxt configuration; do not place it in `runtimeConfig.public.contentMermaid`, environment-driven public runtime configuration, or code that changes after the application has started.

```ts
// v3: valid build-time activation
export default defineNuxtConfig({
  contentMermaid: { enabled: false },
})

// v3: invalid public runtime transport
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      contentMermaid: { enabled: false },
    },
  },
})
```

The public runtime transport is read once for each Nuxt application (and for each SSR render context), producing a package-owned, frozen Runtime Mermaid Snapshot. Later mutations are not a rerender, reinitialization, or activation API.

## 3. Transport only pure data at runtime

`runtimeConfig.public.contentMermaid` accepts recursively pure data: strings, booleans, `null`, finite numbers, plain objects, and arrays. It rejects functions, class instances, accessors, symbols, `undefined`, cycles, non-finite numbers, and negative zero.

```ts
// v3: valid runtime transport
runtimeConfig: {
  public: {
    contentMermaid: {
      loader: { init: { flowchart: { curve: 'basis' } } },
    },
  },
}

// v3: move this client-only capability to Direct Mermaid Config
runtimeConfig: {
  public: {
    contentMermaid: {
      loader: { init: { sequence: { actorFont: () => ({ fontSize: 14 }) } } },
    },
  },
}
```

Pass a supported function or provider-owned capability directly to a component instead:

```vue
<Mermaid
  :code="diagram"
  :config="{ sequence: { actorFont: () => ({ fontSize: 14 }) } }"
/>
```

## 4. Choose Page or Direct Mermaid Config

Content-authored Markdown uses Page Mermaid Config. Put pure data in the page frontmatter `config` field (and declare that field in the Nuxt Content collection schema); the Markdown Diagram Protocol supplies it as `pageConfig`.

````md
---
config:
  theme: forest
---

```mermaid
flowchart LR
  PAGE --> CONFIG
```
````

Application code uses Direct Mermaid Config through the `config` prop. It may use the supported client-only capabilities described above. `pageConfig` and `config` are discriminators, not override layers: supplying both is a component configuration error. Remove one source to recover; the component renders only the latest legal state.

## 5. Account for Property-Presence Merge

Package-owned configuration layers use Property-Presence Merge. Only an absent property falls back; a present value replaces the lower layer unless both values are plain objects. Arrays, `null`, `false`, `0`, empty strings, and empty arrays are all deliberate replacements.

```ts
// Lower layer
{ tags: ['default'], label: 'Mermaid', limit: 3, theme: 'dark' }

// Higher layer
{ tags: [], label: '', limit: 0, theme: null }

// Result
{ tags: [], label: '', limit: 0, theme: null }
```

Do not rely on `defu`-style backfilling for those values.

## 6. Treat `expand` booleans as resets

`expand: true` and `expand: false` each reset the complete expand preset, discarding lower-layer custom values. An object is a Property-Presence patch instead.

```ts
// Lower layer
{ expand: false }

// Does not reactivate expansion
{ expand: { margin: 32 } }

// Explicitly reactivates expansion
{ expand: { enabled: true, margin: 32 } }
```

## 7. Recognize only public diagnostics and rendering guarantees

Configuration failures expose a Minimal Public Diagnostic Fingerprint:

| Boundary | `name` | `code` |
| --- | --- | --- |
| Module/runtime configuration | `ContentMermaidConfigurationError` | `CONTENT_MERMAID_CONFIGURATION_ERROR` |
| Component source conflict | `MermaidComponentConfigurationError` | `CONTENT_MERMAID_COMPONENT_CONFIGURATION_ERROR` |

Do not depend on private issue schemas, queue state, staging IDs, or exact debug-log wording. A render is transactional: the latest successfully committed diagram remains visible when a later render fails, becomes stale, or is blocked by a source conflict.

## 8. Remove package-root transform imports

Version 3 removes the undocumented package-root runtime and TypeScript export named `transformMermaidCodeBlocks`. There is no replacement package-root API. Package users should install the Nuxt module through its default export and let the module own Markdown transformation.

## Migration checklist

- Replace every live `mermaidContent` key with `contentMermaid`.
- Remove package-root imports of `transformMermaidCodeBlocks`; use the Nuxt module default export.
- Keep `enabled` only in module configuration.
- Restrict public runtime transport to pure data and move client-only capabilities to Direct Mermaid Config.
- Use Page Mermaid Config for Markdown and Direct Mermaid Config for application code, never both on one component.
- Audit intentional empty, falsy, `null`, and array overrides under Property-Presence Merge.
- Review `expand` boolean resets and add `enabled: true` when a higher object must re-enable it.
- Recognize errors by the public `name` and `code`, not internals.
