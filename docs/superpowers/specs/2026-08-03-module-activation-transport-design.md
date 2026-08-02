# Module activation and runtime transport design

## Scope

Implement GitHub issue #25. The module exposes `contentMermaid` as its only
supported Nuxt configuration key. It resolves build-time activation separately
from the public runtime transport and installs Nuxt integration only when
activation succeeds and is enabled.

## Ownership and inputs

Nuxt Kit remains responsible for resolving inline module options and the
`contentMermaid` config key. `defineNuxtModule.defaults` is omitted or empty;
all package defaults remain behind the package-owned resolver so Nuxt cannot
backfill or otherwise erase explicit arrays, `null`, or falsy values before the
package sees its canonical input.

Package defaults are themselves valid strict pure data. Optional properties are
absent rather than present with `undefined` values.

The package-owned resolver applies these resolution layers:

1. internal package defaults;
2. Nuxt-resolved module options; and
3. build-time `runtimeConfig.public.contentMermaid` overrides.

Only the two application-owned layers cross the resolver interface. Package
defaults remain an implementation detail so callers cannot replace or reorder
them.

It validates every input before reading values from it. Application-owned input
is observed through property descriptors, so validation and diagnostics never
read getters, invoke setters, call serialization hooks, or trigger other
application-owned behavior. Structural validation uses the existing strict
pure-data primitive, while named resolvers own package-domain validation and use
the existing Property-Presence Merge primitive.

## Resolver design

`src/configuration/module.ts` exposes one pure interface to callers and tests:

```ts
interface ModuleConfigurationInput {
  nuxtResolvedOptions: unknown
  runtimeOverrides: unknown
}

interface ResolvedModuleConfiguration {
  enabled: boolean
  runtimeOptions: RuntimeOptions
}

function resolveModuleConfiguration(
  input: ModuleConfigurationInput,
): ResolvedModuleConfiguration
```

Its implementation uses private, named resolvers:

- `resolveModuleActivation` merges package defaults with Nuxt-resolved options
  and returns the build-only `enabled` result. An absent value falls back to the
  package default; a present value must be a boolean.
- `resolveRuntimeTransport` merges package defaults, Nuxt-resolved options, and
  runtime overrides in that exact low-to-high order after excluding activation.
- `resolveModuleConfiguration` coordinates validation and both internal
  resolvers, then returns activation and a wholly package-owned runtime payload
  only after every phase succeeds.

The runtime payload is an owned clone but remains mutable for Nuxt's build-time
transport. Deep freezing belongs to the later Universal Runtime Adapter and its
per-NuxtApp Runtime Mermaid Snapshot.

The runtime override is rejected whenever its own `enabled` property is
present, regardless of the property's value. Activation never participates in
runtime precedence and is absent from the final transport. Package-owned closed
fields receive domain validation; Mermaid-owned open payloads retain unknown
strict-pure-data keys. The final merged transport is validated again before it
is returned.

All configuration failures expose the exact global fingerprint:

- name: `ContentMermaidConfigurationError`
- code: `CONTENT_MERMAID_CONFIGURATION_ERROR`

Internal phase, issue, and path details remain non-public.

## Removed alias preflight

`src/module.ts` owns a descriptor-safe preflight for the removed top-level Nuxt
configuration key. Presence of an own `mermaidContent` property on Nuxt options
produces the migration error even when its value is `undefined` or implemented
as an accessor; the accessor is never invoked.

`runtimeConfig.public.mermaidContent` is not a supported resolver input. The
module never reads, writes, removes, mirrors, or falls back to it; the package
only owns the canonical `runtimeConfig.public.contentMermaid` transport.

## Module setup preflight and activation gate

`src/module.ts` first performs removed-alias preflight and complete configuration
resolution without installing CSS, plugins, components, imports, type
templates, Vite plugins, or Markdown hooks. Validation always completes before
activation is acted upon, so disabled module options cannot hide an alias,
invalid configuration, or a runtime activation override.

If activation is disabled, setup returns without mutating public runtime config
or registering integration. If enabled, setup writes exactly one resolved
`runtimeConfig.public.contentMermaid` payload and then installs the existing
Nuxt integration. The gate guarantees that configuration failures occur before
integration installation; it does not claim rollback for unrelated failures
during later Nuxt integration calls.

## Verification

Focused tests exercise only the public `resolveModuleConfiguration` interface.
They demonstrate descriptor safety, fixed precedence, explicit array, `null`,
falsy, and empty-value replacement, activation type validation, rejection of
runtime activation even when disabled, final transport validation, output
ownership without build-time freezing, and absence of activation from
transport.

Module-setup tests prove property-presence alias failure, including `undefined`
and accessor cases, before any integration mutation. Disabled setup separately
asserts that CSS, plugins, components, imports, type additions, Vite plugins,
Markdown hooks, and public runtime config remain untouched. Enabled setup
publishes only the canonical package-owned payload and installs every expected
integration point without mirroring the legacy key.

Type tests preserve the removed alias and build-only activation contracts. Nuxt
fixtures verify enabled and disabled behavior, precedence, migration failure,
and transport output. The compatibility check runs those relevant fixtures in
a dependency matrix covering the minimum supported Nuxt 3 (`3.20.1`) and Nuxt
4 (`4.1.0`) lines rather than inferring range compatibility from one installed
Nuxt version.
