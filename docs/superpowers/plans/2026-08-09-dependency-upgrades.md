# Dependency Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade every currently outdated dependency that remains compatible with the repository's Nuxt 4, Node 22/24, and module-builder constraints, then publish the verified change as a Draft PR.

**Architecture:** Keep dependency policy centralized in `pnpm-workspace.yaml` catalogs and regenerate `pnpm-lock.yaml` with pnpm. Treat declared peer dependencies and supported runtime versions as hard boundaries; use the existing behavioral, type, lint, package, and build checks as the compatibility proof.

**Tech Stack:** pnpm 10, Nuxt 4, TypeScript 5.9, Vitest 4, Playwright, ESLint 10.

## Global Constraints

- Preserve Node support at `>=22.19.0` and the CI matrix at Node 22.19.0/24.19.0.
- Keep `typescript` at `~5.9.3` because `@nuxt/module-builder@1.0.3` declares `typescript: ^5.9.3`.
- Keep the existing `@types/node` 25 baseline instead of expanding it to Node 26 APIs while the package is validated on Node 22/24; align typings to the oldest supported runtime in a separate compatibility change.
- Preserve each catalog entry's existing exact-versus-range policy.
- Do not modify runtime behavior solely to accommodate a dependency update unless a verified compatibility failure requires it.

---

## Risk Assessment

- Patch-only runtime updates (`defu`, `yaml`, `@nuxtjs/color-mode`) are low risk and are covered by configuration, rendering, and metadata tests.
- Tooling minor updates (Nuxt DevTools/ESLint/Test Utils, Vitest, Playwright, vue-tsc) can change diagnostics or browser revisions; verify them through lint, the full E2E suite, type checks, package contracts, and a production build.
- `@nuxtjs/mdc` is pre-1.0, so `0.20.1` to `0.23.0` is treated as medium risk despite the minor version numbers. The intervening releases contain sanitizer security fixes, dependency upgrades, config/cache fixes, and Vite 8 alias-resolution suppression; no removal of the directly used `parseMarkdown` runtime export or `MDCElement` type is announced. Direct protocol/transform tests, type checks, and the production build must remain green.
- `@nuxt/content@3.15.2` continues to resolve its internal `@nuxtjs/mdc@0.22.2`, while this repository's direct test dependency resolves `0.23.0`. The dual versions are intentional until Nuxt Content adopts 0.23; direct tests validate the MDC runtime/type API used by this repository's transform test harness without overriding Content's internal dependency.
- `typescript@7` is high risk and incompatible: `@nuxt/module-builder@1.0.3` declares `typescript: ^5.9.3`, and TypeScript 7 does not yet provide the stable programmatic API required by Vue/Volar-style embedded tooling.
- `@types/node@26` is deferred because its declarations model Node 26 while CI and the documented runtime baseline exercise Node 22/24. Keeping the already-established Node 25 typings avoids expanding the mismatch in this dependency-only change.

---

### Task 1: Upgrade compatible catalog entries

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Existing `catalog:dev`, `catalog:integrations`, and `catalog:test` references from workspace packages.
- Produces: One resolved dependency graph with the latest compatible versions.

- [x] **Step 1: Update compatible catalog versions**

Set these catalog entries while preserving their existing range style:

```yaml
dev:
  '@nuxt/devtools': 3.4.1
  '@nuxt/eslint-config': 1.17.0
  '@nuxt/module-builder': 1.0.3
  '@nuxtjs/color-mode': 4.0.1
  defu: ^6.1.7
  eslint: ^10.8.1
  vue-tsc: ^3.3.9
  yaml: ^2.9.0
integrations:
  '@nuxtjs/mdc': ^0.23.0
test:
  '@nuxt/test-utils': ^4.1.0
  playwright: ^1.62.1
  vitest: ^4.1.10
```

- [x] **Step 2: Regenerate the lockfile**

Run: `pnpm install`

Expected: installation exits 0 with no strict peer-dependency error.

- [x] **Step 3: Confirm only intentional packages remain outdated**

Run: `pnpm outdated`

Expected: only `typescript` and `@types/node` are reported.

### Task 2: Verify the upgraded toolchain

**Files:**
- Test: `test/**/*.test.ts`
- Test: `playground/**`
- Test: `scripts/release-verification/**`

**Interfaces:**
- Consumes: The dependency graph produced by Task 1.
- Produces: Evidence that source behavior, types, package contracts, browser behavior, and production builds remain valid.

- [x] **Step 1: Run lint**

Run: `pnpm lint`

Expected: exit 0.

- [x] **Step 2: Run the full Vitest suite**

Run: `python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/run_vitest.py --root .`

Expected: all test files and tests pass.

- [x] **Step 3: Run type checks**

Run: `pnpm test:types`

Expected: root and playground `vue-tsc` checks exit 0.

- [x] **Step 4: Verify package contract and production build**

Run: `pnpm test:package-contract && pnpm dev:build`

Expected: package contract and playground production build exit 0.

- [x] **Step 5: Review the final diff and commit**

Run: `git diff --check && git diff --stat && git status -sb`

Expected: only the plan, catalog, lockfile, and any strictly required compatibility fixes are changed.

Commit: `chore(deps): upgrade compatible dependencies`
