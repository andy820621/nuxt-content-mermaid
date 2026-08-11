# Stable Expanded Transition Coordinates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the source Mermaid renderer stationary while expanded mode animates monotonically between the visible source slice and the complete layout viewport.

**Architecture:** Treat source measurement and document scroll locking as one expand-session transaction. Capture the pre-lock layout width and scrollbar gutter before changing overflow, pin the underlying page to that coordinate space, and let the existing clip/diagram layers animate to the full viewport through the existing `isExpanded` state.

**Tech Stack:** Vue 3 composables, Nuxt 4, `@nuxt/test-utils/e2e`, Playwright, Vitest, TypeScript.

## Global Constraints

- Work only in `/Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid-fix-missing-page-config-ssr` on `codex/fix-missing-page-config-ssr` and update PR #84 with base `main`.
- Do not modify or merge PR #83, publish packages, create tags or releases, or modify release/RID/MIV workflow records.
- Add no public option, prop, component, or configuration contract.
- Preserve missing-page-config normalization, strict application `pageConfig: null`, configured Content behavior, MDC 0.23.1 packaging, fullscreen centering, syntax-error diagnostics, and migration conflict recovery.
- Preserve source `scrollLeft`/`scrollTop`, zoom/pan behavior, reduced motion, every close policy, ID rewriting, and exact restoration of existing inline document styles.
- Every production change requires a previously observed RED test at an agreed seam.

---

## File Structure

- Modify `test/expandToolbar.e2e.test.ts`: real Nuxt browser regression for stationary source geometry and reversible center motion.
- Modify `test/useMermaidExpand.test.ts`: deterministic browser stubs plus resize/session-gutter behavior.
- Modify `src/runtime/composables/useMermaidExpand.ts`: expand-session layout snapshot and stable scroll-lock refresh.
- Do not modify `MermaidExpandOverlay.vue`; its existing clip/diagram layers and CSS transition interface remain valid once both endpoints share a stable coordinate space.

### Task 1: Pin the source layout for the complete expand session

**Files:**
- Modify: `test/expandToolbar.e2e.test.ts:13-30,188-289`
- Modify: `src/runtime/composables/useMermaidExpand.ts:137-202,663-693`

**Interfaces:**
- Consumes: `useMermaidExpand({ getExpandTarget, getExpandViewport, expandOptions })`, the real `.mermaid-wrapper`, and the existing `Expand diagram` / `Minimize diagram` controls.
- Produces: an internal scroll-lock snapshot containing the pre-lock layout width and scrollbar gutter; no public interface changes.

- [ ] **Step 1: Add an independent monotonicity assertion helper**

Add this helper beside `rectDistance` in `test/expandToolbar.e2e.test.ts`:

```ts
function expectMonotonic(values: number[], direction: 1 | -1) {
  expect(values.length).toBeGreaterThan(2)
  for (let index = 1; index < values.length; index++) {
    expect((values[index]! - values[index - 1]!) * direction).toBeGreaterThanOrEqual(-0.25)
  }
}
```

The production mutation this catches is a target center that changes direction or overshoots while travelling between its two literal endpoints.

- [ ] **Step 2: Add the real-browser regression before production changes**

Add one test using `#secondary-root`, whose 600px SVG is centered and does not horizontally overflow. Slow only the two transition layers to 600ms linear, then capture literal browser rectangles:

```ts
it('keeps a centered source stationary while expanded motion reverses one path', { timeout: 20000 }, async () => {
  const page = await createPage()
  await page.goto(url('/'))
  await page.waitForSelector('#mock-svg-secondary', { state: 'visible', timeout: 5000 })
  await page.addStyleTag({
    content: `
      .ncm-expand-clip,
      .ncm-expand-target {
        transition-duration: 600ms !important;
        transition-timing-function: linear !important;
      }
    `,
  })

  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>('#secondary-root')!
    const source = root.querySelector<SVGSVGElement>('.mermaid > svg')!
    root.scrollIntoView({ block: 'center' })
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    const centerX = (element: Element) => {
      const rect = element.getBoundingClientRect()
      return rect.left + rect.width / 2
    }
    const sourceBefore = source.getBoundingClientRect()
    const gutter = window.innerWidth - document.documentElement.clientWidth
    const cloneMounted = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector('.ncm-expand-target > svg')) return
        observer.disconnect()
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })

    root.querySelector<HTMLButtonElement>('[aria-label="Expand diagram"]')!.click()
    await cloneMounted
    const sourceWhileLocked = source.getBoundingClientRect()
    const opening: number[] = []
    for (let index = 0; index < 48; index++) {
      const target = document.querySelector<HTMLElement>('.ncm-expand-target')
      if (target) opening.push(centerX(target))
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }

    document.querySelector<HTMLButtonElement>('[aria-label="Minimize diagram"]')!.click()
    const closing: number[] = []
    for (let index = 0; index < 48; index++) {
      const target = document.querySelector<HTMLElement>('.ncm-expand-target')
      if (target) closing.push(centerX(target))
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    const sourceAfter = source.getBoundingClientRect()

    return {
      gutter,
      viewportCenter: window.innerWidth / 2,
      sourceBefore: { left: sourceBefore.left, center: sourceBefore.left + sourceBefore.width / 2 },
      sourceWhileLocked: { left: sourceWhileLocked.left, center: sourceWhileLocked.left + sourceWhileLocked.width / 2 },
      sourceAfter: { left: sourceAfter.left, center: sourceAfter.left + sourceAfter.width / 2 },
      opening,
      closing,
    }
  })

  expect(result.gutter).toBeGreaterThan(0)
  expect(result.sourceWhileLocked.left).toBeCloseTo(result.sourceBefore.left, 0)
  expect(result.sourceAfter.left).toBeCloseTo(result.sourceBefore.left, 0)
  expect(result.opening[0]).toBeCloseTo(result.sourceBefore.center, 0)
  expect(result.opening.at(-1)).toBeCloseTo(result.viewportCenter, 0)
  expect(result.closing[0]).toBeCloseTo(result.viewportCenter, 0)
  expect(result.closing.at(-1)).toBeCloseTo(result.sourceBefore.center, 0)
  expectMonotonic(result.opening, 1)
  expectMonotonic(result.closing, -1)
})
```

- [ ] **Step 3: Run the single browser test and record RED**

Run:

```bash
python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/run_vitest.py \
  --root . \
  --test-name "keeps a centered source stationary" \
  -- test/expandToolbar.e2e.test.ts
```

Expected RED on current `2b644ee`: the page has a positive scrollbar gutter and `sourceWhileLocked.left` is about half that gutter to the right of `sourceBefore.left`.

- [ ] **Step 4: Capture scroll-lock geometry before overflow mutation**

Extend the private `scrollState` in `useMermaidExpand.ts`:

```ts
const scrollState = {
  bodyOverflow: '',
  bodyWidth: '',
  htmlOverflow: '',
  htmlWidth: '',
  scrollbarGutter: 0,
  layoutWidth: 0,
  lockedWidth: false,
  locked: false,
}
```

Replace the order inside `disableBodyScroll()` so width is captured and applied before overflow changes:

```ts
const layoutWidth = getLockedViewportWidth()
const viewportWidth = getLayoutViewportSize().width
scrollState.layoutWidth = layoutWidth
scrollState.scrollbarGutter = Math.max(0, Math.round(viewportWidth - layoutWidth))
scrollState.lockedWidth = scrollState.scrollbarGutter > 0
scrollState.locked = true

if (scrollState.lockedWidth) {
  document.documentElement.style.width = `${layoutWidth}px`
  document.body.style.width = `${layoutWidth}px`
}
document.documentElement.style.overflow = 'hidden'
document.body.style.overflow = 'hidden'
```

Reset `layoutWidth` and `scrollbarGutter` to zero in `enableBodyScroll()` after restoring the four captured application styles. Do not change `calculateExpandMetrics`, the double opening RAF, or overlay CSS.

Delete `shouldLockWidth()`: the captured positive `scrollbarGutter` is now the single decision for whether width locking is required. Leaving the old helper would preserve a second, timing-dependent source of truth and fail lint as unused.

- [ ] **Step 5: Re-run the browser regression and confirm GREEN**

Run the Step 3 command again. Expected: source rectangles agree within one CSS pixel, opening values increase only toward the full viewport center, and closing values decrease only toward the original source center.

- [ ] **Step 6: Commit the first vertical slice**

```bash
git add test/expandToolbar.e2e.test.ts src/runtime/composables/useMermaidExpand.ts
git commit -m "fix: stabilize expanded transition coordinates"
```

### Task 2: Keep the coordinate model stable across viewport resize

**Files:**
- Modify: `test/useMermaidExpand.test.ts:84-121,293-320`
- Modify: `src/runtime/composables/useMermaidExpand.ts:184-202,583-605`

**Interfaces:**
- Consumes: the private expand-session `scrollbarGutter`, the current layout viewport, and document `scrollHeight`.
- Produces: non-animated resize refresh that never clears the active width lock before remeasurement.

- [ ] **Step 1: Make the unit browser stub reproduce scrollbar disappearance**

Refactor `createBrowser()` so `documentElement.clientWidth` reports the content width before lock and the complete viewport after `overflow: hidden`. Return a `resizeViewport` helper:

```ts
const viewportState = { width: 1000, height: 800, gutter: 20 }
const documentElement = {
  style: { overflow: 'visible', width: '120px', userSelect: 'text' },
  clientHeight: 800,
  scrollHeight: 1200,
}
Object.defineProperty(documentElement, 'clientWidth', {
  get: () => documentElement.style.overflow === 'hidden'
    ? viewportState.width
    : viewportState.width - viewportState.gutter,
})
```

Use `viewportState` for `window.innerWidth` and `visualViewport.width`, and return:

```ts
resizeViewport(width: number, height: number, scrollHeight: number) {
  viewportState.width = width
  viewportState.height = height
  windowTarget.innerWidth = width
  windowTarget.innerHeight = height
  visualViewport.width = width
  visualViewport.height = height
  documentElement.clientHeight = height
  documentElement.scrollHeight = scrollHeight
}
```

This is a browser boundary fake, not a mock of project code. Existing style-restoration assertions remain literal.

- [ ] **Step 2: Add a failing resize test**

Add:

```ts
it('derives resized layout width from the session gutter without unlocking', async () => {
  const ctx = setupExpand()
  await openExpand(ctx.expand, browser)

  expect(document.documentElement.style.width).toBe('980px')
  expect(document.body.style.width).toBe('980px')

  browser.resizeViewport(800, 600, 1200)
  browser.windowTarget.dispatch('resize')
  browser.flushRafs()
  expect(document.documentElement.style.width).toBe('780px')
  expect(document.body.style.width).toBe('780px')

  browser.resizeViewport(800, 1400, 1200)
  browser.windowTarget.dispatch('resize')
  browser.flushRafs()
  expect(document.documentElement.style.width).toBe('800px')
  expect(document.body.style.width).toBe('800px')

  ctx.expand.toggle()
  finishClose(ctx.target)
  expect(document.documentElement.style.width).toBe('120px')
  expect(document.body.style.width).toBe('80px')
})
```

The production mutation this catches is clearing the lock and reading `clientWidth` while overflow is already hidden, which returns the full 800px even when the session must retain the 20px gutter.

- [ ] **Step 3: Run the unit test and record RED**

```bash
python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/run_vitest.py \
  --root . \
  --test-name "derives resized layout width" \
  -- test/useMermaidExpand.test.ts
```

Expected RED: the first resized locked width is `800px`, not the required literal `780px`.

- [ ] **Step 4: Refresh from the session baseline without an unlocked intermediate frame**

Replace `updateLockedWidth()` with:

```ts
function updateLockedWidth() {
  if (!scrollState.lockedWidth || document.body.style.overflow !== 'hidden') return

  const { width, height } = getLayoutViewportSize()
  const needsVerticalScrollbar = document.documentElement.scrollHeight > height
  const gutter = needsVerticalScrollbar ? scrollState.scrollbarGutter : 0
  const layoutWidth = Math.max(1, Math.round(width - gutter))
  scrollState.layoutWidth = layoutWidth
  document.documentElement.style.width = `${layoutWidth}px`
  document.body.style.width = `${layoutWidth}px`
}
```

Remove the width-clearing and forced-reflow sequence. `refreshExpandMetrics()` already calls `updateLockedWidth()` before reading source rectangles, so no new scheduler or public seam is required.

- [ ] **Step 5: Re-run the focused unit test and the full expand files**

```bash
python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/run_vitest.py \
  --root . \
  -- test/useMermaidExpand.test.ts test/expandToolbar.e2e.test.ts
```

Expected: both files pass with no unhandled errors or warnings.

- [ ] **Step 6: Commit the resize slice**

```bash
git add test/useMermaidExpand.test.ts src/runtime/composables/useMermaidExpand.ts
git commit -m "fix: preserve expanded layout across resize"
```

### Task 2a: Align the fixed overlay with the layout viewport

Real-browser verification exposed a browser-boundary case that the first stub did not model: before scroll lock, Chromium reported `innerWidth=1280`, `documentElement.clientWidth=1265`, and `visualViewport.width=1265`. Using the visual viewport for the fixed overlay therefore hid the 15px gutter and produced a 1265px destination even though the scrollbar-free overlay occupies 1280px.

**Files:**
- Modify: `test/useMermaidExpand.test.ts`
- Modify: `src/runtime/composables/useMermaidExpand.ts`

- [ ] **Step 1: Add a failing browser-boundary unit test**

Set the stubbed `visualViewport.width` to 980 while leaving `window.innerWidth` at 1000 and pre-lock `clientWidth` at 980. Assert that opening pins the document to 980px while the expanded clip remains 1000px wide.

Expected RED: the old implementation leaves the original 120px document width because it subtracts 980 from 980 and concludes that no scrollbar gutter exists.

- [ ] **Step 2: Use layout viewport dimensions for fixed-overlay geometry**

Return `window.innerWidth` and `window.innerHeight` from `getLayoutViewportSize()`. Keep visual viewport resize listeners as refresh triggers, but do not mix their scrollbar-reduced width with the fixed overlay's layout-viewport coordinates.

- [ ] **Step 3: Re-run the focused unit and expand browser tests**

Expected GREEN: the new boundary test passes, the document remains pinned, and the existing opening/closing and resize regressions remain green.

### Task 3: Verify real playground behavior and the complete PR baseline

**Files:**
- No repository source changes are planned in this task. If a verification command fails, stop this task, return to the diagnosis loop, and add a separate RED → GREEN slice for the confirmed in-scope cause.
- Update: PR #84 body through `gh pr edit`; do not edit release records in the repository.

**Interfaces:**
- Consumes: the complete PR #84 branch, the existing port 3001 playground, and GitHub checks.
- Produces: verified local/browser/CI evidence on PR #84; no merge, publish, tag, or release.

- [ ] **Step 1: Run targeted expand tests**

```bash
python /Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.agents/skills/vitest/scripts/run_vitest.py \
  --root . \
  -- test/useMermaidExpand.test.ts test/expandToolbar.e2e.test.ts
```

- [ ] **Step 2: Run the required complete local verification**

```bash
pnpm lint
pnpm test
pnpm test:types
pnpm test:package-contract
pnpm dev:build
git diff --check
```

Record exact exit codes and test counts. A failure is reported as a failure until its relationship to this change is established.

- [ ] **Step 3: Verify the actual playground in a JavaScript-enabled browser**

Using port 3001 without touching the unrelated process on port 3000, verify:

- `/mermaid/classdiagram/finance-ledger`: underlying source position is unchanged while locked; opening travels monotonically from source center to full viewport center; closing reverses it with no reveal jump.
- `/mermaid/userjourney/mobile-ordering?type=userJourney`: opening and closing remain correct at left and right horizontal scroll positions.
- `/test-debug`: the intentional syntax-error chart still shows the detailed error presentation.
- `/migration`: conflict count and visible recovery remain correct.
- `/`, `/test-debug`, and `/migration-page-config`: HTTP 200, hydration succeeds, no MDC virtual-component import failures, catch-all import failures, Nuxt 500 page, or related console errors.

- [ ] **Step 4: Inspect scope and remove diagnostics**

```bash
rg -n "\[DEBUG-" src test playground || true
git status --short
git diff --check
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- src/runtime/composables/useMermaidExpand.ts test/useMermaidExpand.test.ts test/expandToolbar.e2e.test.ts
```

Keep only PR #84's approved bug fixes, fixtures, tests, dependency floor, design/plan documents, and this coordinate-space correction.

- [ ] **Step 5: Push the same branch and update PR #84**

```bash
git push origin codex/fix-missing-page-config-ssr
```

Update the PR body with the 1265px → 1280px root cause, why the nested clip/target animation was not the source of the reversal, the session-coordinate fix, RED → GREEN commands, real-browser evidence, complete local verification, and the requirement to rerun release baseline/MIV after merge. State explicitly that PR #83 and release records were not modified.

- [ ] **Step 6: Wait for every PR #84 GitHub check**

```bash
gh pr checks 84 --watch --interval 10
gh pr view 84 --json url,state,isDraft,mergeable,statusCheckRollup,headRefOid
```

Report each final check conclusion. Do not merge the PR.
