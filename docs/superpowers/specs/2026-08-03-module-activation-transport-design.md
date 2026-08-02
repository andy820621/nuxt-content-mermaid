# Module activation and runtime transport design

## Scope

Implement GitHub issue #25. The module exposes `contentMermaid` as its only
supported Nuxt configuration key. It resolves build-time activation separately
from the public runtime transport and installs Nuxt integration only when
activation succeeds and is enabled.

## Ownership and inputs

Nuxt Kit remains responsible for resolving inline module options and the
`contentMermaid` config key. `defineNuxtModule.defaults` must not contain the
package's complete defaults, so Nuxt does not erase explicit arrays, `null`, or
falsy values before package-owned resolution.

The package-owned resolver receives:

1. package defaults;
2. Nuxt-resolved module options; and
3. build-time `runtimeConfig.public.contentMermaid` overrides.

It observes each input through property descriptors and uses the existing
strict-pure-data validation and Property-Presence Merge primitives. It neither
reads getters nor triggers application-owned behavior while diagnosing input.

## Resolver design

`src/configuration/module.ts` will hold pure, named resolver functions:

- `resolveModuleActivation` merges package defaults with Nuxt-resolved options
  and returns the build-only `enabled` result.
- `resolveRuntimeTransport` merges package defaults, Nuxt-resolved options, and
  runtime overrides in that exact low-to-high order after excluding activation.
- `resolveModuleConfiguration` coordinates the two results and returns a
  frozen, package-owned runtime payload only after all validation succeeds.

The resolver rejects `enabled` in runtime overrides. It also diagnoses the
removed `mermaidContent` alias before any integration is registered. Errors use
the existing public diagnostic fingerprint.

## Module setup transaction

`src/module.ts` first performs alias detection and resolution without installing
CSS, plugins, components, imports, type templates, Vite plugins, or Markdown
hooks. If activation is disabled, setup returns without mutating the runtime
payload or registering integration. If enabled, setup writes exactly one
`runtimeConfig.public.contentMermaid` payload and then installs the existing
Nuxt integration. It never reads, writes, or falls back to `mermaidContent`.

## Verification

Focused module-resolver tests will demonstrate descriptor safety, fixed
precedence, explicit replacement values, alias failure, rejection of runtime
activation, and output ownership. Module-setup tests will prove that disabled
setup installs no integrations and leaves runtime transport untouched, whereas
enabled setup publishes only the canonical payload and installs all expected
integration points. Type tests will preserve the removed alias and build-only
activation contracts. The existing Nuxt fixture suite remains the compatibility
check for the supported Nuxt 3/4 range.
