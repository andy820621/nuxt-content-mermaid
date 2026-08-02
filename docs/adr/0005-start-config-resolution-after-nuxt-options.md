---
status: accepted
---

# Start package configuration resolution after Nuxt options

The canonical resolver accepts Nuxt-Resolved Module Options as one upstream input and owns only the observable seam whose priority is runtime public overrides over Nuxt-Resolved Module Options over package defaults, using Property-Presence Merge. Inline module options and the `contentMermaid` config key remain under Nuxt Kit's pre-setup `defu` semantics; README keeps `contentMermaid` as the only primary configuration path, and the package retains `defineNuxtModule` metadata, compatibility checks, and installation lifecycle instead of reimplementing Nuxt option resolution.

Complete package defaults are removed from `defineNuxtModule.defaults` and applied only inside the named resolver, which returns separate `{ enabled, runtime }` values so runtime overrides cannot structurally modify Module Activation. When observable, the raw config-key value receives best-effort validation, followed by validation of Nuxt-Resolved Module Options, runtime public overrides, and the final output; the package does not promise to reconstruct an inline value already normalized by Nuxt.
