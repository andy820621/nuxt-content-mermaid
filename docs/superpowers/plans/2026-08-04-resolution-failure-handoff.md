# Resolution-failure Diagnostic and Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Ticket #48 with an attempt-scoped one-shot resolution-failure handoff that reports an internal diagnostic before committing Built-in Renderer ownership.

**Architecture:** `rendererSelection.ts` supplies the internal one-shot failure-commit seam, while `Mermaid.vue` retains the existing current-request guard and injects the production console reporter plus Built-in ownership effect. Public Nuxt browser fixtures verify understandable diagnostics, ordering, exactly-once fallback, and `components.error` isolation without turning console formatting or diagnostic layout into a contract.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Nuxt, Vitest, `@nuxt/test-utils/e2e`, Playwright, pnpm.

## Global Constraints

- The exactly-once identity is one current Renderer Selection attempt that actually commits Built-in ownership.
- A superseded attempt whose outcome becomes stale emits no diagnostic and performs no fallback through the existing `Mermaid.vue` current-request guard.
- The failure commit is synchronous and non-yielding: diagnostic first, Built-in ownership second.
- `not-found` and `load-failed` share the same failure-commit entry; `load-failed` preserves its original failure value.
- Console output is unconditional with respect to `debug` and contains the package prefix, candidate, and understandable reason.
- No public export, option, error class, prop, stable structured schema, dynamic-import requirement, or Custom Renderer execution fallback is added.
- Tests do not pin exact console wording, punctuation, console method, diagnostic property layout, internal function names, or helper implementation.

---

## File Structure

- Modify `src/runtime/rendererSelection.ts`: define the internal failure diagnostic and create one one-shot synchronous handoff per selection attempt.
- Modify `src/runtime/components/Mermaid.vue`: retain the current-request check, inject console reporting and Built-in ownership commit, and remove parallel failure warnings/fallback assignment.
- Modify `test/rendererSelection.test.ts`: verify semantic values, original failure context, exactly-once behavior, independent attempts, and diagnostic-before-ownership ordering.
- Create `test/rendererSelectionArchitecture.test.ts`: characterize that the existing current-request guard precedes settled-outcome handling without naming the new handoff function.
- Modify `test/helpers/diagnosticCapture.ts`: capture established semantic instrumentation regardless of whether production uses `console.log`, `console.warn`, or `console.error`.
- Modify `test/customRendererFallback.e2e.test.ts`: verify the `debug: false` `not-found` public fallback path.
- Modify `test/fixtures/custom-renderer-fallback/nuxt.config.ts`: make `debug: false` explicit and configure an error component that must remain unused.
- Create `test/fixtures/custom-renderer-fallback/components/TestError.vue`: observable proof that resolution failure does not use `components.error`.
- Create `test/customRendererLoadFailed.e2e.test.ts`: verify the `debug: true` `load-failed` public fallback and ordering path.
- Create `test/fixtures/custom-renderer-load-failed/{app.vue,package.json,nuxt.config.ts}`: Nuxt browser fixture for a rejecting Custom Renderer module.
- Create `test/fixtures/custom-renderer-load-failed/components/{BrokenRenderer.vue,TestError.vue}`: client module-load rejection and forbidden error-presentation sentinel.

---

### Task 1: Internal attempt-scoped one-shot failure commit

**Files:**
- Modify: `test/rendererSelection.test.ts`
- Modify: `src/runtime/rendererSelection.ts`

**Interfaces:**
- Consumes: existing `RendererSelectionSettledOutcome` failures from `selectRenderer`.
- Produces: one internal factory returning a synchronous handler for `not-found` and `load-failed` outcomes; injected effects are `reportDiagnostic` and `commitBuiltInOwnership`.

- [ ] **Step 1: Add a semantic test helper and a failing `not-found` one-shot test**

Add a test-local recursive value collector so assertions verify semantic values without deep-equaling a diagnostic object:

```ts
function collectSemanticValues(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(collectSemanticValues)
  if (value instanceof Error || value === null || typeof value !== 'object') return [value]
  return Object.values(value).flatMap(collectSemanticValues)
}
```

Then create a handoff with injected spies, invoke it twice for one `not-found` outcome, and assert:

```ts
expect(order).toEqual(['diagnostic', 'built-in'])
expect(reported).toHaveLength(1)
expect(collectSemanticValues(reported[0])).toEqual(expect.arrayContaining([
  'resolution-failed',
  'MissingRenderer',
  'not-found',
]))
expect(commitBuiltInOwnership).toHaveBeenCalledOnce()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/rendererSelection.test.ts
```

Expected: FAIL because the attempt-scoped failure handoff does not exist.

- [ ] **Step 3: Implement the minimal one-shot synchronous handoff**

Add internal-only types and a factory in `rendererSelection.ts`. Keep the diagnostic type unexported; only the internal runtime function is imported by `Mermaid.vue`.

```ts
type RendererSelectionFailureOutcome = Extract<
  RendererSelectionSettledOutcome,
  { readonly status: 'not-found' | 'load-failed' }
>

type RendererSelectionDiagnostic = {
  readonly event: 'resolution-failed'
  readonly candidate: string
  readonly reason: RendererSelectionFailureOutcome['status']
  readonly error?: unknown
}

interface RendererResolutionFailureHandoffDependencies {
  readonly reportDiagnostic: (diagnostic: RendererSelectionDiagnostic) => void
  readonly commitBuiltInOwnership: () => void
}

/** @internal */
export function createRendererResolutionFailureHandoff(
  dependencies: RendererResolutionFailureHandoffDependencies,
) {
  let committed = false

  return (outcome: RendererSelectionFailureOutcome) => {
    if (committed) return
    committed = true

    dependencies.reportDiagnostic({
      event: 'resolution-failed',
      candidate: outcome.candidate,
      reason: outcome.status,
    })
    dependencies.commitBuiltInOwnership()
  }
}
```

The exact names and object layout remain implementation defaults and may be adjusted during implementation while preserving the semantic assertions.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same focused command. Expected: PASS with no warnings or unhandled errors.

- [ ] **Step 5: Add the failing `load-failed` context test**

Use `const failure = new Error('chunk unavailable')`, invoke a fresh handoff with a `load-failed` outcome, and assert the collected semantic values include the same `failure` object in addition to `resolution-failed`, candidate, and `load-failed`.

- [ ] **Step 6: Run RED, preserve the original failure value, then run GREEN**

Run the focused file and confirm it fails because the original error is absent. Add the original failure only for `load-failed` diagnostics:

```ts
const diagnostic = outcome.status === 'load-failed'
  ? {
      event: 'resolution-failed' as const,
      candidate: outcome.candidate,
      reason: outcome.status,
      error: outcome.error,
    }
  : {
      event: 'resolution-failed' as const,
      candidate: outcome.candidate,
      reason: outcome.status,
    }
```

Run the focused file again. Expected: PASS.

- [ ] **Step 7: Prove independent later attempts are independent**

Create two handoff instances with shared spies, invoke each twice, and assert two diagnostics and two ownership commits in alternating diagnostic/ownership order. This test verifies attempt scoping without adding retry or cancellation state.

- [ ] **Step 8: Typecheck the root and commit the vertical slice**

Run:

```bash
pnpm exec vue-tsc --noEmit
git add src/runtime/rendererSelection.ts test/rendererSelection.test.ts
git commit -m "feat: add one-shot renderer failure handoff"
```

Expected: typecheck passes and the commit contains only the internal seam plus focused tests.

---

### Task 2: Route `not-found` through the Mermaid orchestration handoff

**Files:**
- Create: `test/rendererSelectionArchitecture.test.ts`
- Modify: `test/customRendererFallback.e2e.test.ts`
- Modify: `test/helpers/diagnosticCapture.ts`
- Modify: `test/fixtures/custom-renderer-fallback/nuxt.config.ts`
- Create: `test/fixtures/custom-renderer-fallback/components/TestError.vue`
- Modify: `src/runtime/components/Mermaid.vue`

**Interfaces:**
- Consumes: the one-shot failure handler from Task 1 and existing `latestRendererSelectionRequestId` currency check.
- Produces: one production reporter and one Built-in ownership callback injected per pending attempt.

- [ ] **Step 1: Characterize the existing stale guard at the Mermaid orchestration seam**

Read `Mermaid.vue` as source, isolate the renderer-selection watch block, and use regex capture groups for arbitrary local names to prove the incremented request identity is compared after `await outcome.resolution` and before any settled `status` branch. Do not mention the new handoff function name or add a cancellation state.

```ts
const currentAttemptFlow = rendererSelectionWatch.match(
  /const\s+(\w+)\s*=\s*\+\+(\w+)[\s\S]+?await\s+\w+\.resolution[\s\S]+?if\s*\(\s*\1\s*!==\s*\2\s*\)\s*return/,
)
expect(currentAttemptFlow).not.toBeNull()
```

Run the focused architecture file. Expected: PASS, characterizing the current-request owner without changing Renderer Selection.

- [ ] **Step 2: Expand test diagnostic capture without fixing a console method**

Refactor `installDiagnosticCapture` so the same `capture(args)` wrapper is installed for `console.log`, `console.warn`, and `console.error`. Preserve each original console method and argument list.

- [ ] **Step 3: Strengthen the `debug: false` browser fixture and write the failing public assertions**

Set `debug: false` explicitly, configure `components.error: 'TestError'`, and add a sentinel component:

```vue
<template>
  <div data-testid="configured-error">
    Built-in error presentation
  </div>
</template>
```

Before navigation, install diagnostic capture and collect every browser console message text without filtering by method. Assert after fallback:

```ts
expect(messages.some(message => (
  message.includes('[nuxt-content-mermaid]')
  && message.includes('MissingRenderer')
  && message.includes('not-found')
))).toBe(true)
expect(events.filter(event => event === 'resolution-failed')).toHaveLength(1)
expect(runCount).toBe(1)
expect(await page.getByTestId('configured-error').count()).toBe(0)
```

Run only `test/customRendererFallback.e2e.test.ts`. Expected: RED because the legacy warning does not contain the semantic reason/event and the new handoff is not wired.

- [ ] **Step 4: Inject the production reporter and route `not-found` per current attempt**

Import `MERMAID_LOG_PREFIX` and the Task 1 handoff factory. After the pending state is assigned and before awaiting resolution, create the attempt-scoped handoff:

```ts
const commitResolutionFailure = createRendererResolutionFailureHandoff({
  reportDiagnostic: (diagnostic) => {
    const failureContext = diagnostic.reason === 'load-failed'
      ? [diagnostic.error]
      : []

    console.warn(
      MERMAID_LOG_PREFIX,
      `Custom Renderer Candidate "${diagnostic.candidate}" resolution failed (${diagnostic.reason}).`,
      diagnostic,
      ...failureContext,
    )
  },
  commitBuiltInOwnership: () => {
    rendererSelectionState.value = { status: 'built-in' }
  },
})
```

Keep the existing request-id check immediately after the await. A current `resolved` outcome keeps the Custom Renderer branch; a current `not-found` outcome calls `commitResolutionFailure(resolvedOutcome)`. Remove the legacy `not-found` warning. Retain the existing `load-failed` console/fallback branch only as the temporary next RED seam; Task 3 replaces it with the same handoff and removes the final parallel path.

- [ ] **Step 5: Run the focused E2E, unit test, and typecheck**

Run:

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/rendererSelection.test.ts test/rendererSelectionArchitecture.test.ts
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/customRendererFallback.e2e.test.ts
pnpm exec vue-tsc --noEmit
```

Expected: all pass; the browser emits one understandable diagnostic and performs one Built-in render without showing the configured error component.

- [ ] **Step 6: Commit the public `not-found` vertical slice**

```bash
git add src/runtime/components/Mermaid.vue test/rendererSelectionArchitecture.test.ts test/helpers/diagnosticCapture.ts test/customRendererFallback.e2e.test.ts test/fixtures/custom-renderer-fallback/nuxt.config.ts test/fixtures/custom-renderer-fallback/components/TestError.vue
git commit -m "feat: commit renderer fallback after diagnostics"
```

---

### Task 3: Cover `load-failed`, debug-on ordering, and ownership isolation

**Files:**
- Modify: `src/runtime/components/Mermaid.vue`
- Create: `test/customRendererLoadFailed.e2e.test.ts`
- Create: `test/fixtures/custom-renderer-load-failed/app.vue`
- Create: `test/fixtures/custom-renderer-load-failed/package.json`
- Create: `test/fixtures/custom-renderer-load-failed/nuxt.config.ts`
- Create: `test/fixtures/custom-renderer-load-failed/components/BrokenRenderer.vue`
- Create: `test/fixtures/custom-renderer-load-failed/components/TestError.vue`

**Interfaces:**
- Consumes: the shared resolution-failure handoff, existing Built-in `renderer:create` debug instrumentation, and the existing test Mermaid run counter.
- Produces: a browser-level `load-failed` contract at `debug: true`.

- [ ] **Step 1: Create a client module-load failure fixture**

Configure `debug: true`, `loader.lazy: false`, `components.renderer: 'BrokenRenderer'`, and `components.error: 'TestError'`. Reuse the existing fixture Mermaid stub through a Nuxt alias. The component must reject during client module evaluation, not during setup or mount:

```vue
<script lang="ts">
import { defineComponent } from 'vue'

if (import.meta.client)
  throw new Error('BrokenRenderer fixture failed during module load')

export default defineComponent({})
</script>
```

This distinction ensures the outcome is `load-failed`; a `<script setup>` throw would be a Custom Renderer execution failure and is forbidden from falling back.

- [ ] **Step 2: Write the focused browser test**

Install diagnostic capture before navigation, collect all console message text, wait for the fallback SVG, and assert:

```ts
expect(messages.some(message => (
  message.includes('[nuxt-content-mermaid]')
  && message.includes('BrokenRenderer')
  && message.includes('load-failed')
))).toBe(true)
expect(messages.some(message => (
  message.includes('BrokenRenderer fixture failed during module load')
))).toBe(true)

const diagnosticIndex = events.indexOf('resolution-failed')
const factoryIndex = events.indexOf('renderer:create')
expect(diagnosticIndex).toBeGreaterThanOrEqual(0)
expect(factoryIndex).toBeGreaterThan(diagnosticIndex)
expect(events.filter(event => event === 'resolution-failed')).toHaveLength(1)
expect(events.filter(event => event === 'renderer:create')).toHaveLength(1)
expect(runCount).toBe(1)
expect(await page.getByTestId('configured-error').count()).toBe(0)
```

The fixture failure text is an independent known input; the assertions do not pin surrounding wording, punctuation, or console method.

- [ ] **Step 3: Run the focused browser test and verify RED**

Run:

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/customRendererLoadFailed.e2e.test.ts
```

Expected: FAIL because the temporary legacy `load-failed` branch does not emit the shared semantic event or include the candidate and `load-failed` reason.

- [ ] **Step 4: Route `load-failed` through the same one-shot handoff**

Replace the temporary legacy `load-failed` console/fallback branch so all current failures use the same commit:

```ts
if (resolvedOutcome.status === 'resolved') {
  rendererSelectionState.value = {
    status: 'custom',
    component: resolvedOutcome.component,
  }
}
else {
  commitResolutionFailure(resolvedOutcome)
}
```

This removes the final old warning/callback fallback and independent Built-in assignment. Run the focused browser test again. Expected: PASS with `resolution-failed` before `renderer:create`, one factory creation, one Mermaid execution, and no configured error component.

- [ ] **Step 5: Re-run focused internal, fallback, and successful Custom Renderer coverage**

Run:

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/rendererSelection.test.ts test/rendererSelectionArchitecture.test.ts
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/customRendererFallback.e2e.test.ts
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/customRenderer.e2e.test.ts
```

Expected: setup/mount failure remains with the Custom Renderer, with no Built-in factory, Mermaid execution, or configured error component.

- [ ] **Step 6: Commit the `load-failed` browser slice**

```bash
git add src/runtime/components/Mermaid.vue test/customRendererLoadFailed.e2e.test.ts test/fixtures/custom-renderer-load-failed
git commit -m "test: cover renderer load failure fallback"
```

---

### Task 4: Review, full verification, and publication readiness

**Files:**
- Review: all changes from `main...HEAD`
- Modify only when a verified review or validation finding requires it.

**Interfaces:**
- Consumes: accepted design spec, Ticket #48, repository standards, and all focused test evidence.
- Produces: reviewed, fully verified commits ready to push and open as a PR.

- [ ] **Step 1: Run formatting/lint repair and inspect the resulting diff**

```bash
pnpm lint --fix
git diff --check
git status --short
```

Preserve unrelated files and commit only task-related mechanical fixes.

- [ ] **Step 2: Run the two-axis `/code-review` against `main`**

Run Standards and Spec review in parallel as required by the project skill. The Spec source is Issue #48 plus `docs/superpowers/specs/2026-08-04-resolution-failure-handoff-design.md`. Fix verified findings with focused tests; rerun the affected checks after each fix.

- [ ] **Step 3: Run the complete verification gates**

```bash
pnpm lint
pnpm test
pnpm test:types
pnpm test:package-contract
pnpm prepack
```

Expected: every command exits zero with no unresolved warnings or unhandled errors. The full Vitest run includes both browser fixtures.

- [ ] **Step 4: Commit any final review fixes and verify the branch is clean**

```bash
git add src/runtime/rendererSelection.ts src/runtime/components/Mermaid.vue test/rendererSelection.test.ts test/rendererSelectionArchitecture.test.ts test/helpers/diagnosticCapture.ts test/customRendererFallback.e2e.test.ts test/customRendererLoadFailed.e2e.test.ts test/fixtures/custom-renderer-fallback test/fixtures/custom-renderer-load-failed
git commit -m "fix: address renderer fallback review findings"
git status --short --branch
git log main..HEAD --oneline
```

Skip the commit when review produces no changes. The branch must be clean before push.

- [ ] **Step 5: Push, create the PR, and shepherd it to ready**

Push `codex/issue-48-diagnostic-fallback`, create a non-draft PR targeting `main`, include `Closes #48`, the change summary, and exact verification results. Use the repository PR template if present. Observe CI, reviews, conflicts, and current head freshness until the PR completion watcher reports `ready`.

- [ ] **Step 6: Stop at the landing confirmation gate**

Report the PR URL, current head SHA, commits pushed, checks/reviews, and the planned squash action. Obtain explicit confirmation for that exact head SHA before invoking the approved landing helper. After confirmation, observe the PR until merged, verify Issue #48 is closed, update local `main`, and report the final squash commit and validation state.

## Plan Self-review

- Spec coverage: attempt identity, synchronous ordering, semantic data, original failure context, stale no-op ownership, debug matrix, Built-in exactly-once behavior, `components.error` isolation, and Custom Renderer execution ownership all map to explicit tasks.
- Placeholder scan: every code-producing step names exact files, behavior, commands, and expected outcomes.
- Type consistency: failure outcomes come from `RendererSelectionSettledOutcome`; only `load-failed` carries `error`; the injected handler accepts both failure variants and no resolved variant.
- Scope check: no public surface, cancellation state, reporter exception protocol, dynamic import, or unrelated renderer refactor is introduced.
