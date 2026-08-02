# Module Activation and Runtime Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `contentMermaid` the sole module configuration path, resolve build-time activation independently from a canonical pure-data runtime transport, and install integration only for a validated enabled module.

**Architecture:** A new pure `src/configuration/module.ts` receives only Nuxt-resolved options and canonical public-runtime overrides. It validates descriptor-safely, resolves internal defaults through named activation and transport resolvers, and returns `{ enabled, runtimeOptions }`. `src/module.ts` performs legacy-key preflight and complete resolution before activation and side effects; enabled setup atomically publishes the sole transport before installing current integration.

**Tech Stack:** Nuxt Kit, TypeScript ESM, Vitest, existing descriptor-safe configuration core, pnpm, GitHub Actions.

## Global Constraints

- Support Nuxt `^3.20.1 || ^4.1.0`; do not use Nuxt 4.3-only native module-disable syntax.
- `defineNuxtModule.defaults` is omitted or empty; complete defaults remain private to the resolver.
- Use property descriptors for every application-owned diagnostic; never invoke getters, setters, or serialization hooks.
- Runtime transport accepts only strict pure data and never includes `enabled`; the build-time output is owned but not frozen.
- Merge exactly package defaults → Nuxt-resolved options → `runtimeConfig.public.contentMermaid`; arrays, `null`, and every explicit falsy value replace lower values.
- `mermaidContent` is a removed top-level Nuxt key: its own-property presence fails before integration is installed. The runtime alias is never read, written, removed, or used as a fallback.
- Disabled setup still completes preflight and configuration validation, then changes neither public runtime config nor CSS, Vite plugins, components, imports, type templates, plugins, or Markdown hooks.
- Preserve the existing public `$mermaid`, component, styling, lazy-loading, and theme contracts; Runtime Mermaid Snapshot work is ticket #26 and out of scope.

---

### Task 1: Define the public module-resolution seam and its red tests

**Files:**
- Create: `test/moduleConfiguration.test.ts`
- Test: `test/package-contract/v3-configuration.ts` (existing runtime-only and removed-alias assertions)

**Interfaces:**
- Consumes: `RuntimeOptions`, `ModuleOptions`, and pure-data types from `src/types/config.ts`.
- Produces: an internal test contract for `resolveModuleConfiguration(input: { nuxtResolvedOptions: unknown; runtimeOverrides: unknown }): { enabled: boolean; runtimeOptions: RuntimeOptions }` without making the resolver a package-root export.

- [ ] **Step 1: Add failing resolver tests for precedence and activation separation**

```ts
it('merges defaults, Nuxt options, then runtime overrides without transporting enabled', () => {
  const result = resolveModuleConfiguration({
    nuxtResolvedOptions: { enabled: false, toolbar: { title: 'Nuxt' }, expand: false },
    runtimeOverrides: { toolbar: { title: '' }, expand: { margin: 24 }, debug: false },
  })

  expect(result.enabled).toBe(false)
  expect(result.runtimeOptions).toMatchObject({
    debug: false,
    toolbar: { title: '' },
    expand: { enabled: false, margin: 24 },
  })
  expect(result.runtimeOptions).not.toHaveProperty('enabled')
})
```

- [ ] **Step 2: Run the focused test to verify it fails because the resolver is absent**

Run: `pnpm vitest run test/moduleConfiguration.test.ts`

Expected: FAIL with a module-not-found or missing-export error for `src/configuration/module.ts`.

- [ ] **Step 3: Confirm the existing package-user type assertions cover the public transport boundary**

```ts
// @ts-expect-error activation is not available in runtime transport
void resolvedPublicRuntimeConfig.contentMermaid?.enabled
```

- [ ] **Step 4: Run the package contract check to establish the current public boundary**

Run: `pnpm test:package-contract`

Expected: PASS; the resolver remains an internal source-module seam, and the existing contract keeps `enabled` outside `PublicRuntimeConfig`.

### Task 2: Implement the pure descriptor-safe Module Configuration Resolver

**Files:**
- Create: `src/configuration/module.ts`
- Modify: `src/types/config.ts`
- Modify: `test/moduleConfiguration.test.ts`

**Interfaces:**
- Consumes: `assertStrictData`, `cloneOwnedData`, `mergeByPresence`, and `ContentMermaidConfigurationError` from `src/configuration/core.ts`.
- Produces: `resolveModuleConfiguration` as the sole exported resolver function; named private `resolveModuleActivation` and `resolveRuntimeTransport` helpers.

- [ ] **Step 1: Add failing tests for all raw and final validation obligations**

```ts
it('rejects a runtime enabled property before activation is considered', () => {
  expect(() => resolveModuleConfiguration({
    nuxtResolvedOptions: { enabled: false },
    runtimeOverrides: { enabled: false },
  })).toMatchObject({
    name: 'ContentMermaidConfigurationError',
    code: 'CONTENT_MERMAID_CONFIGURATION_ERROR',
  })
})

it('diagnoses accessors without executing them', () => {
  let calls = 0
  const runtimeOverrides = {}
  Object.defineProperty(runtimeOverrides, 'debug', {
    enumerable: true,
    get: () => { calls += 1; return true },
  })

  expect(() => resolveModuleConfiguration({ nuxtResolvedOptions: {}, runtimeOverrides })).toThrow()
  expect(calls).toBe(0)
})
```

Include cases for invalid activation type, open Mermaid configuration preservation, explicit `null`, `0`, `false`, `''`, and `[]`, source immutability, owned mutable output, and a final invalid value produced by a malformed layer.

- [ ] **Step 2: Run the focused resolver tests and verify the newly added cases fail**

Run: `pnpm vitest run test/moduleConfiguration.test.ts`

Expected: FAIL only for unimplemented resolver behavior; record each failure before production code is added.

- [ ] **Step 3: Implement private defaults and named resolver functions**

```ts
export interface ModuleConfigurationInput {
  readonly nuxtResolvedOptions: unknown
  readonly runtimeOverrides: unknown
}

export interface ResolvedModuleConfiguration {
  readonly enabled: boolean
  readonly runtimeOptions: RuntimeOptions
}

export function resolveModuleConfiguration(
  input: ModuleConfigurationInput,
): ResolvedModuleConfiguration {
  // validate both raw application-owned layers before extracting data
  // resolve activation from package defaults + Nuxt options only
  // reject own runtime `enabled`; merge the three transport layers in order
  // validate final transport, clone it, and return a mutable owned RuntimeOptions
}
```

Keep package defaults strict-pure-data by omitting optional component values instead of assigning `undefined`. Use descriptor extraction rather than spreads or `Object.entries` on application-owned inputs. Make package-owned envelopes closed, retaining unknown keys only below Mermaid-owned `loader.init`.

- [ ] **Step 4: Run focused resolver and type-contract checks to verify green**

Run: `pnpm vitest run test/moduleConfiguration.test.ts && pnpm test:package-contract`

Expected: PASS; resolver behavior is covered without exporting diagnostics or resolver internals from the package root.

- [ ] **Step 5: Commit the resolver slice**

```bash
git add src/configuration/module.ts src/types/config.ts test/moduleConfiguration.test.ts test/package-contract/v3-configuration.ts
git commit -m "feat: resolve module activation and runtime transport"
```

### Task 3: Make setup a canonical alias-preflight and activation transaction

**Files:**
- Modify: `src/module.ts`
- Modify: `test/moduleSetup.test.ts`
- Modify: `src/runtime/plugins/mermaid.client.ts`
- Modify: `src/runtime/components/Mermaid.vue`

**Interfaces:**
- Consumes: `resolveModuleConfiguration` and its returned `enabled` and `runtimeOptions`.
- Produces: setup that writes only `runtimeConfig.public.contentMermaid` after validated enabled resolution; runtime consumers that consume only canonical runtime options.

- [ ] **Step 1: Extend module-setup tests with failing preflight and transaction assertions**

```ts
it('fails for an own legacy alias without invoking its getter or registering integration', async () => {
  let calls = 0
  Object.defineProperty(nuxt.options, 'mermaidContent', {
    enumerable: true,
    get: () => { calls += 1; return undefined },
  })

  await expect(moduleDef.setup?.({}, nuxt)).rejects.toMatchObject({
    name: 'ContentMermaidConfigurationError',
    code: 'CONTENT_MERMAID_CONFIGURATION_ERROR',
  })
  expect(calls).toBe(0)
  expect(addPlugin).not.toHaveBeenCalled()
  expect(nuxt.options.runtimeConfig.public).toEqual({})
})

it('leaves runtime config and every integration point untouched when disabled', async () => {
  const before = { retained: { value: true } }
  nuxt.options.runtimeConfig.public = before
  await moduleDef.setup?.({ enabled: false }, nuxt)
  expect(nuxt.options.runtimeConfig.public).toBe(before)
  expect(addImports).not.toHaveBeenCalled()
  expect(hooks).toEqual({})
})
```

Add enabled assertions that runtime transport is owned, has no `enabled`, keeps no `mermaidContent` mirror, and is written before any registration calls. Add a runtime-alias sentinel getter to prove module setup does not read it.

- [ ] **Step 2: Run module-setup tests and verify the new cases fail under the legacy implementation**

Run: `pnpm vitest run test/moduleSetup.test.ts`

Expected: FAIL because setup currently reads/warns on the alias, installs defaults through Nuxt, and mirrors legacy transport.

- [ ] **Step 3: Replace legacy resolution in `src/module.ts` with preflight, resolver, and gate**

```ts
setup(options, nuxt) {
  assertNoLegacyModuleAlias(nuxt.options)
  const resolved = resolveModuleConfiguration({
    nuxtResolvedOptions: options,
    runtimeOverrides: nuxt.options.runtimeConfig.public.contentMermaid,
  })

  if (!resolved.enabled) return

  nuxt.options.runtimeConfig.public.contentMermaid = resolved.runtimeOptions
  // Existing CSS, Vite, plugin, component, import, type-template, and hook registration follows.
}
```

Remove `defu`, module-level complete `defaults`, logger deprecation warnings, all `mermaidContent` reads/writes, and `enabled` runtime checks. Use an own-descriptor preflight on `nuxt.options` so even `undefined` and accessor aliases fail. Update plugin/component input types from `ModuleOptions` to `RuntimeOptions` and consume only `public.contentMermaid`.

- [ ] **Step 4: Run narrow setup and runtime-consumer tests to verify green**

Run: `pnpm vitest run test/moduleSetup.test.ts test/mermaidClientDebug.test.ts`

Expected: PASS; disabled setup has zero setup side effects and enabled setup exposes only canonical runtime transport.

- [ ] **Step 5: Commit the setup transaction slice**

```bash
git add src/module.ts src/runtime/plugins/mermaid.client.ts src/runtime/components/Mermaid.vue test/moduleSetup.test.ts test/mermaidClientDebug.test.ts
git commit -m "feat: gate Nuxt integration by module activation"
```

### Task 4: Verify Nuxt fixtures and the declared Nuxt compatibility range

**Files:**
- Create: `test/fixtures/module-configuration/nuxt.config.ts`
- Create: `test/fixtures/module-configuration/app.vue`
- Create: `test/moduleConfiguration.e2e.test.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the package module exactly as a Package User configures it through `defineNuxtConfig`.
- Produces: fixture-level evidence for enabled transport, disabled no-registration behavior, precedence, migration failure, and Nuxt 3/4 range execution.

- [ ] **Step 1: Add failing Nuxt fixture scenarios**

```ts
it('renders the effective canonical public transport', async () => {
  const html = await $fetch('/')
  expect(html).toContain('runtime-config-sentinel')
  expect(html).not.toContain('"enabled"')
})

it('rejects a fixture using the removed mermaidContent key before startup integration', async () => {
  await expect(startLegacyFixture()).rejects.toMatchObject({
    name: 'ContentMermaidConfigurationError',
    code: 'CONTENT_MERMAID_CONFIGURATION_ERROR',
  })
})
```

Make the enabled fixture set conflicting default/module/runtime fields (including array, `null`, and falsy replacements) and expose the resolved canonical transport using `useRuntimeConfig`. Keep a separate disabled fixture whose application proves no Mermaid component/plugin registration is present.

- [ ] **Step 2: Run the fixture test and verify it fails before fixture implementation**

Run: `pnpm vitest run test/moduleConfiguration.e2e.test.ts`

Expected: FAIL because the fixture and canonical resolver integration do not yet exist.

- [ ] **Step 3: Implement the fixtures and test only observable Package User behavior**

```ts
export default defineNuxtConfig({
  modules: [contentMermaidModule],
  contentMermaid: { toolbar: { title: 'Nuxt option' } },
  runtimeConfig: { public: { contentMermaid: { toolbar: { title: '' } } } },
})
```

Do not inspect private resolver functions from E2E tests. Keep mock-only scenarios in `test/moduleConfiguration.test.ts`.

- [ ] **Step 4: Add CI compatibility matrix without changing tracked dependency manifests**

```yaml
strategy:
  matrix:
    nuxt-version: ['3.20.1', '4.1.0']
steps:
  - run: pnpm --config.overrides.nuxt=${{ matrix.nuxt-version }} install --no-frozen-lockfile
  - run: pnpm vitest run test/moduleConfiguration.e2e.test.ts
```

Resolve matching `@nuxt/kit`, `@nuxt/schema`, and test-utils peer versions in the install command or an ephemeral CI override file so every matrix entry has compatible peers. Preserve the existing default CI jobs; this matrix is limited to the new module fixture contract.

- [ ] **Step 5: Run the local fixture suite and verify green**

Run: `pnpm vitest run test/moduleConfiguration.e2e.test.ts`

Expected: PASS against the installed Nuxt line; CI runs the Nuxt `3.20.1` and `4.1.0` matrix.

- [ ] **Step 6: Commit fixture and CI coverage**

```bash
git add test/fixtures/module-configuration test/moduleConfiguration.e2e.test.ts .github/workflows/ci.yml
git commit -m "test: cover canonical module configuration"
```

### Task 5: Run the release-relevant checks and resolve review findings

**Files:**
- Modify only if verification or review reveals a task-scope defect.
- Test: all affected tests plus repository lint, types, package build, and playground production build.

**Interfaces:**
- Consumes: all prior implementation slices.
- Produces: verified branch ready for the required two-axis code review and pull request.

- [ ] **Step 1: Run formatting/lint and repair only ticket-scoped findings**

Run: `pnpm lint --fix && pnpm lint`

Expected: PASS with no lint errors.

- [ ] **Step 2: Run unit and type gates**

Run: `pnpm test && pnpm test:types && pnpm test:package-contract`

Expected: PASS; keep the full Vitest output as the test-suite evidence.

- [ ] **Step 3: Run build gates**

Run: `pnpm prepack && pnpm dev:build`

Expected: PASS; do not commit generated `dist` artifacts.

- [ ] **Step 4: Run whitespace and change-scope checks**

Run: `git diff --check main...HEAD && git status --short && git diff --stat main...HEAD`

Expected: no whitespace errors and only issue #25 implementation, tests, fixtures, CI, and plan/design files.

- [ ] **Step 5: Perform the required `code-review` two-axis review against `main`**

Use: `git diff main...HEAD` and Issue #25 as the specification source. Run independent Standards and Spec reviews, fix every actionable finding with focused tests, then rerun the affected verification commands.

- [ ] **Step 6: Commit review fixes if needed**

```bash
git add <ticket-scoped-files>
git commit -m "fix: address module configuration review findings"
```
