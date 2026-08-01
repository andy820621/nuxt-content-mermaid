# Built-in Renderer Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every Built-in Renderer trigger through the internal Mermaid rendering factory, preserve Vue presentation behavior, and remove the superseded shallow queue seam.

**Architecture:** `Mermaid.vue` creates one `createMermaidRenderer` request function with stable closure-based dependencies. The component continues to own loading, error, `hasRenderedOnce`, and Custom Renderer presentation, while `mermaid-rendering.ts` owns validation, FIFO execution, Mermaid protocol, normalization, cleanup, and diagnostics.

**Tech Stack:** TypeScript, Vue 3 SFCs, Nuxt 3/4 module runtime, `@nuxt/test-utils/e2e`, Playwright, Vitest, pnpm.

## Global Constraints

- Public `$mermaid` remains `() => Promise<Mermaid>` and keeps the shared Mermaid instance behavior.
- Custom Renderer props, slots, selection, spinner behavior, and DOM output remain unchanged.
- Loading starts when a Render Request is proposed; prior error clears only when a valid Render Attempt starts.
- Preserve the current boolean loading timing for multiple pending requests; do not add a counter.
- Preserve lazy, theme/config, toolbar, expand/fullscreen, DOM/CSS hook, and diagnostic ordering semantics.
- Do not add cancellation, deduplication, coalescing, concurrency changes, new hooks, public API, or unrelated fixes.
- Test at the Built-in Renderer component seam; do not observe or reset the private factory queue.

---

## Task 1: Add a controllable Built-in Renderer browser seam

**Files:**

- Create: `test/fixtures/built-in-renderer/nuxt.config.ts`
- Create: `test/fixtures/built-in-renderer/package.json`
- Create: `test/fixtures/built-in-renderer/app.vue`
- Create: `test/fixtures/built-in-renderer/mermaid-stub.ts`
- Create: `test/fixtures/built-in-renderer/components/TestSpinner.vue`
- Create: `test/fixtures/built-in-renderer/components/TestError.vue`
- Create: `test/builtInRenderer.e2e.test.ts`

**Interfaces:**

- Consumes: the public `<Mermaid :code>` component, named loading/error presentation, and browser-visible DOM.
- Produces: a `window.__mermaidControl__` system-boundary fake with `pending`, `runs`, `lastError`, and `releaseNext()` for deterministic Render Attempt timing.

- [ ] **Step 1: Create the minimal Nuxt fixture**

Configure the real module with non-lazy Built-in Renderer, debug diagnostics, the fixture Mermaid alias, and named spinner/error components:

```ts
export default defineNuxtConfig({
  modules: [MyModule, '@nuxt/content'],
  alias: { mermaid: resolve(fixtureDir, 'mermaid-stub.ts') },
  compatibilityDate: '2025-11-24',
  nitro: { compatibilityDate: '2025-11-24' },
  contentMermaid: {
    debug: true,
    loader: { lazy: false },
    components: { spinner: 'TestSpinner', error: 'TestError' },
  },
})
```

The app owns a primary diagram and an optional blocker diagram. Buttons set the primary source to success, failure, recovery, queued, or empty values and mount/update the blocker. Both `code` props use `encodeURIComponent`.

- [ ] **Step 2: Implement the deterministic Mermaid boundary fake**

Use one deferred resolver per `run()` and record only system-boundary facts needed by component assertions:

```ts
type MermaidControl = {
  pending: number
  runs: Array<{ source: string, id: number }>
  lastError?: Error
  releaseNext: () => void
}

const pendingResolvers: Array<() => void> = []
const control: MermaidControl = {
  pending: 0,
  runs: [],
  releaseNext() {
    pendingResolvers.shift()?.()
  },
}

const mermaidStub = {
  initialize: () => {},
  run: async ({ nodes }: { nodes?: HTMLElement[] } = {}) => {
    const target = nodes?.[0]
    if (!target) return
    const source = target.textContent || ''
    const id = control.runs.length + 1
    control.runs.push({ source, id })
    control.pending++
    await new Promise<void>(resolve => pendingResolvers.push(resolve))
    control.pending--

    if (source.includes('__FAIL__')) {
      const error = new Error('Broken diagram')
      control.lastError = error
      throw error
    }

    target.innerHTML = `<svg data-run-id="${id}" data-source="${source}"></svg>`
  },
}
```

`TestError.vue` renders the error message and a `data-same-error` attribute comparing its `error` prop with `window.__mermaidControl__.lastError`. This verifies identity through presentation rather than asserting an internal call.

- [ ] **Step 3: Write the first failing Built-in Renderer integration test**

Intercept structured browser diagnostics before navigation, wait for the custom spinner, release the initial Mermaid run, and assert rendered SVG plus semantic factory events:

```ts
it('starts loading at enqueue and renders through factory diagnostics', async () => {
  const page = await createPage()
  await installDiagnosticCapture(page)
  await page.goto(url('/'))

  await page.getByTestId('built-in-spinner').waitFor({ state: 'visible' })
  await waitForPending(page, 1)
  await releaseNext(page)
  await page.locator('#primary svg[data-run-id="1"]').waitFor({ state: 'visible' })

  const events = await readDiagnosticEvents(page)
  expect(events).toEqual(expect.arrayContaining([
    'queue:enqueue',
    'queue:start',
    'attempt:duration',
    'queue:finish',
  ]))
})
```

The production mutation caught by this test is routing the Built-in Renderer around `createMermaidRenderer`; the current shallow queue emits strings rather than these semantic events.

- [ ] **Step 4: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run test/builtInRenderer.e2e.test.ts
```

Expected: FAIL because the semantic `queue:*` / `attempt:*` diagnostic events are absent, while the spinner and rendered output succeed.

---

## Task 2: Migrate `Mermaid.vue` to the factory and map outcomes

**Files:**

- Modify: `src/runtime/components/Mermaid.vue`
- Test: `test/builtInRenderer.e2e.test.ts`

**Interfaces:**

- Consumes: `createMermaidRenderer(dependencies): () => Promise<MermaidRenderOutcome>` from `src/runtime/mermaid-rendering.ts`.
- Produces: one zero-argument Render Request function per Built-in Renderer instance and unchanged Vue presentation behavior.

- [ ] **Step 1: Replace the shallow queue dependency with the factory**

Change imports so `parseSizeToPx` and `isRecord` remain in `../utils`, while rendering comes from the deep module:

```ts
import { parseSizeToPx, isRecord } from '../utils'
import { createMermaidRenderer } from '../mermaid-rendering'
```

- [ ] **Step 2: Configure the factory once with closure-based stable dependencies**

Create the request function after all reactive dependencies and expand helpers exist, before lifecycle hooks register triggers:

```ts
const requestRender = createMermaidRenderer({
  loadMermaid: $mermaid,
  readRenderData: () => ({
    source: mermaidDefinition.value,
    config: effectiveMermaidInit.value,
    target: mermaidContainer.value,
  }),
  prepare: () => {
    if (import.meta.client && isExpandActive.value)
      resetExpand()

    hasError.value = false
    errorContent.value = null
  },
  debug,
})
```

Factory creation is SSR-safe and performs no Mermaid loading or DOM access.

- [ ] **Step 3: Replace `renderMermaid` execution with presentation mapping**

All existing triggers keep calling `renderMermaid`, which now only proposes the request and maps its outcome:

```ts
async function renderMermaid() {
  isLoading.value = true

  const outcome = await requestRender()

  if (outcome.status === 'success') {
    hasRenderedOnce.value = true
  }
  else if (outcome.status === 'failure') {
    console.error('[nuxt-content-mermaid]', outcome.error)
    hasError.value = true
    errorContent.value = outcome.error
  }

  isLoading.value = false
}
```

Delete component-local Mermaid initialization, target writes, scheduler execution, run invocation, failure cleanup, duration logging, and `ensureViewBox`. Preserve `getMermaidSvg` because expand/fullscreen presentation still reads the rendered SVG through that helper. Do not change mount, lazy observer, theme/config/source watchers, toolbar, expand, or fullscreen code.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run test/builtInRenderer.e2e.test.ts
```

Expected: PASS with semantic factory diagnostics and rendered SVG.

- [ ] **Step 5: Run typechecking after the first vertical slice**

Run:

```bash
pnpm test:types
```

Expected: root and playground Vue typechecking both exit successfully.

---

## Task 3: Lock presentation timing, skipped mapping, and Custom Renderer bypass

**Files:**

- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify: `test/fixtures/built-in-renderer/app.vue`
- Modify: `test/fixtures/built-in-renderer/mermaid-stub.ts`
- Modify: `test/customRenderer.e2e.test.ts`
- Modify: `test/fixtures/custom-renderer/mermaid-stub.ts`

**Interfaces:**

- Consumes: browser-visible loading/error/expand/DOM behavior and the external Mermaid boundary fake.
- Produces: regression coverage for Issue #4 acceptance criteria without private queue assertions.

- [ ] **Step 1: Add error timing and identity coverage**

Establish a successful primary render, render a failing source, mount a blocker, then enqueue primary recovery. Assert the custom error remains while recovery waits, disappears when recovery's attempt starts, and reports `data-same-error="true"` before clearing.

- [ ] **Step 2: Add skipped outcome coverage**

While the blocker owns the FIFO, mount a fresh Built-in Renderer with a non-empty source, observe its public loading slot, and clear its source before dequeue. Release the blocker and assert the fresh component's loading ends without a Mermaid run or error presentation. This catches any caller that still executes an empty latest source instead of honoring the factory's skipped outcome.

- [ ] **Step 3: Add existing boolean loading timing coverage**

After primary and blocker both render successfully, enqueue primary A, blocker B, and primary C in that order. Release primary A so blocker B starts while primary C remains pending. Assert the primary Expand action can open against A's SVG, preserving the existing first-completion-wins boolean timing. Release blocker B, let primary C start and reset the expanded view, then release primary C.

- [ ] **Step 4: Strengthen Custom Renderer bypass coverage**

Expose `window.__builtInMermaidRunCount__` from the Custom Renderer fixture's aliased Mermaid module and assert it remains `0` after custom output appears. Keep existing props, spinner, and SVG assertions.

- [ ] **Step 5: Run each affected browser test**

Run:

```bash
pnpm exec vitest run test/builtInRenderer.e2e.test.ts
pnpm exec vitest run test/customRenderer.e2e.test.ts
```

Expected: both files pass without sleeps used as synchronization for renderer state.

- [ ] **Step 6: Re-run typechecking**

Run `pnpm test:types` and require a successful exit.

---

## Task 4: Remove the shallow queue seam

**Files:**

- Modify: `src/runtime/utils/index.ts`
- Delete: `test/enqueueRender.test.ts`

**Interfaces:**

- Consumes: all caller migration completed in Task 2.
- Produces: no `enqueueRender` export, implementation, test, or remaining caller.

- [ ] **Step 1: Delete `enqueueRender` implementation and its queue state**

Remove `renderQueue`, `queueSize`, and the exported `enqueueRender` function from the top of `src/runtime/utils/index.ts`. Preserve every unrelated utility unchanged.

- [ ] **Step 2: Delete the queue-only test**

Delete `test/enqueueRender.test.ts`; its FIFO and recovery responsibilities are already covered through `mermaidRendering.test.ts` and the Built-in Renderer integration seam.

- [ ] **Step 3: Verify no residual caller**

Run:

```bash
rg -n "enqueueRender" src test
```

Expected: no matches and exit code `1`.

- [ ] **Step 4: Run focused regression files**

Run:

```bash
pnpm exec vitest run test/mermaidRendering.test.ts test/builtInRenderer.e2e.test.ts test/customRenderer.e2e.test.ts
pnpm test:types
```

Expected: all focused tests and both typecheck scopes pass.

---

## Task 5: Full verification, two-axis review, and final commit

**Files:**

- Review all changes since baseline commit `97fce94`.

**Interfaces:**

- Consumes: Issue #4, the approved design spec, repository standards, and all changed files.
- Produces: verified, reviewed, committed current branch.

- [ ] **Step 1: Apply repository formatting and lint**

Run:

```bash
pnpm lint --fix
pnpm lint
```

- [ ] **Step 2: Run the complete project Vitest suite**

The ignored `.agents/skills/vitest/examples` directory is an environment-owned skill bundle that Vitest's default glob sees. Run every project test file while excluding that bundle:

```bash
pnpm exec vitest run --exclude '.agents/**'
```

Require all repository test files and tests to pass. Record the environment-owned default-glob limitation separately; do not add unrelated Vitest configuration.

- [ ] **Step 3: Run type and production/module build gates**

Run:

```bash
pnpm test:types
pnpm prepack
pnpm dev:build
```

Require all commands to exit successfully.

- [ ] **Step 4: Verify scope and deletion requirements**

Run `git diff --check`, `rg -n "enqueueRender" src test`, and inspect `git diff 97fce94...HEAD` plus uncommitted changes. Check each Issue #4 acceptance criterion against direct test, source, or command evidence.

- [ ] **Step 5: Run the repository `code-review` skill**

Use fixed point `97fce94`. Run Standards and Spec reviews in parallel as required by the skill, fix every actionable finding, then re-run affected focused and full gates.

- [ ] **Step 6: Commit the implementation**

Stage only Issue #4 files and commit on the current branch:

```bash
git commit -m "refactor: migrate built-in mermaid renderer"
```

- [ ] **Step 7: Verify final branch state**

Confirm the worktree is clean, `HEAD` contains the implementation commit, and the complete requirement audit has authoritative evidence for every acceptance criterion.
