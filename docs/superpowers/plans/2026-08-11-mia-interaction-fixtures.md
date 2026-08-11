# MIA Interaction and Diagnostic Fixture Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Journey fullscreen alignment, clip-aware expanded close animation, the false syntax-error fixture, and the visually ambiguous migration conflict-recovery fixture in PR #84.

**Architecture:** Fullscreen owns a reversible SVG presentation override. Expanded mode separates the visible clip frame from the complete cloned diagram plane so source scrolling affects only the close destination, not the expanded fit. Playground fixtures use parser-proven and visually distinct states, with real Nuxt browser tests protecting their claims.

**Tech Stack:** Nuxt 4, Vue 3, Nuxt Content, Mermaid 11.16.1, TypeScript, Vitest, `@nuxt/test-utils/e2e`, Playwright.

## Global Constraints

- Work only in `/Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid-fix-missing-page-config-ssr` on `codex/fix-missing-page-config-ssr` and update PR #84 with base `main`.
- Preserve all existing PR #84 commits and do not reset or rebuild the branch.
- Do not modify or merge PR #83, publish packages, create tags/releases, or change RID/MIV records, release versions, changelog, or release workflow.
- Keep application-level `pageConfig: null` invalid and preserve the existing missing-Markdown-config transport behavior.
- Do not introduce a public option or public component prop for the internal expanded scroll viewport.
- Write and run a failing regression test before each production or fixture change.
- Preserve the source scroll position, the transactional last-successful render contract, all close paths, body-scroll cleanup, zoom/pan behavior, and reduced-motion behavior.

---

## File Structure

- `src/runtime/composables/useMermaidFullscreen.ts`: owns reversible fullscreen SVG attribute state in addition to the existing zoom lifecycle.
- `test/useMermaidFullscreen.test.ts`: unit contract for applying and restoring `preserveAspectRatio`.
- `src/runtime/composables/useMermaidExpand.ts`: measures source clip geometry and independently drives clip-frame and diagram-plane styles.
- `src/runtime/components/MermaidExpandOverlay.vue`: renders the new internal clip frame around the existing cloned diagram target.
- `src/runtime/built-in-renderer/BuiltInRenderer.vue`: supplies `.mermaid-wrapper` as the internal expanded viewport.
- `test/useMermaidExpand.test.ts`: unit contract for scrolled clip geometry, animation completion, and cleanup.
- `test/expandToolbar.e2e.test.ts`: real browser coverage for the two-layer expanded DOM and fullscreen attribute lifecycle in the package-user fixture.
- `test/fixtures/expand-toolbar/mermaid-stub.ts`: supplies a wide, scrollable SVG and a Journey-style fullscreen attribute to make browser regressions deterministic.
- `playground/content/test-debug.md`: contains a parser-proven invalid Mermaid definition.
- `test/debugPlayground.e2e.test.ts`: real Nuxt Content/browser regression for the debug route.
- `playground/pages/migration.vue`: exposes distinct direct, conflict-candidate, and recovered definitions and phase output.
- `test/migrationPlayground.e2e.test.ts`: verifies the complete conflict episode and recovery lifecycle.

---

### Task 1: Reversible Fullscreen Centering

**Files:**
- Modify: `test/useMermaidFullscreen.test.ts`
- Modify: `src/runtime/composables/useMermaidFullscreen.ts`
- Modify: `test/fixtures/expand-toolbar/mermaid-stub.ts`
- Modify: `test/expandToolbar.e2e.test.ts`

**Interfaces:**
- Consumes: existing `getRenderTarget(): HTMLElement | null`, fullscreen lifecycle, and `endForDiagramReplacement(): Promise<void>`.
- Produces: internal `centerFullscreenSvg()` and `restoreFullscreenSvg()` behavior; no returned API change.

- [ ] **Step 1: Extend the fullscreen DOM stub with a real attribute model**

Add a child SVG stub returned from `renderTarget.querySelector('svg')`:

```ts
function createSvgAttributeStub(initialValue?: string) {
  const attributes = new Map<string, string>()
  if (initialValue !== undefined) attributes.set('preserveAspectRatio', initialValue)
  return {
    hasAttribute: (name: string) => attributes.has(name),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: vi.fn((name: string, value: string) => attributes.set(name, value)),
    removeAttribute: vi.fn((name: string) => attributes.delete(name)),
  }
}
```

Return the stub from the test browser helper so each test can inspect it.

- [ ] **Step 2: Write failing fullscreen restoration tests**

Add parameterized tests proving both an explicit Journey value and an absent attribute:

```ts
it.each([
  ['xMinYMin meet', 'xMinYMin meet'],
  [undefined, null],
])('centers the SVG only while fullscreen and restores %s', async (initial, restored) => {
  const browser = createBrowser(initial)
  const mounted = mountFullscreen(browser)

  await enterFullscreen(mounted.fullscreen)
  expect(browser.svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')

  await mounted.fullscreen.toggle()
  await nextTick()
  expect(browser.svg.getAttribute('preserveAspectRatio')).toBe(restored)
})
```

Extend the existing exit/replacement/unmount table to assert the original Journey value is restored for all three endings.

- [ ] **Step 3: Run the fullscreen unit test and record RED**

Run:

```bash
pnpm exec vitest run test/useMermaidFullscreen.test.ts
```

Expected: the active SVG keeps `xMinYMin meet` because the fullscreen lifecycle does not yet own `preserveAspectRatio`.

- [ ] **Step 4: Implement exact fullscreen SVG snapshot and restoration**

In `useMermaidFullscreen.ts`, track the actual SVG and whether the attribute was present:

```ts
interface SvgAspectRatioSnapshot {
  target: SVGElement
  hadAttribute: boolean
  value: string | null
}

let aspectRatioSnapshot: SvgAspectRatioSnapshot | null = null

function restoreFullscreenSvg() {
  const snapshot = aspectRatioSnapshot
  aspectRatioSnapshot = null
  if (!snapshot) return
  if (snapshot.hadAttribute) {
    snapshot.target.setAttribute('preserveAspectRatio', snapshot.value ?? '')
  }
  else {
    snapshot.target.removeAttribute('preserveAspectRatio')
  }
}

function centerFullscreenSvg() {
  restoreFullscreenSvg()
  const target = renderTarget.value?.querySelector<SVGElement>('svg')
  if (!target) return
  aspectRatioSnapshot = {
    target,
    hadAttribute: target.hasAttribute('preserveAspectRatio'),
    value: target.getAttribute('preserveAspectRatio'),
  }
  target.setAttribute('preserveAspectRatio', 'xMidYMid meet')
}
```

Call `centerFullscreenSvg()` when the active lifecycle starts and `restoreFullscreenSvg()` inside `stopLifecycle()` before presentation state is reset. Keep style restoration independent.

- [ ] **Step 5: Run the fullscreen unit test and confirm GREEN**

Run:

```bash
pnpm exec vitest run test/useMermaidFullscreen.test.ts
```

Expected: all tests pass, including exit, replacement, unmount, and originally absent attributes.

- [ ] **Step 6: Add deterministic browser coverage**

Give the primary mock SVG emitted by `test/fixtures/expand-toolbar/mermaid-stub.ts` the Journey value:

```html
<svg id="mock-svg" preserveAspectRatio="xMinYMin meet" ...>
```

In the fullscreen browser test assert:

```ts
expect(await page.locator('#mock-svg').getAttribute('preserveAspectRatio')).toBe('xMinYMin meet')
await page.locator('#diagram-root').getByLabel('Enter fullscreen').click()
expect(await page.locator('#mock-svg').getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
await page.locator('#diagram-root').getByLabel('Exit fullscreen').click()
expect(await page.locator('#mock-svg').getAttribute('preserveAspectRatio')).toBe('xMinYMin meet')
```

- [ ] **Step 7: Run the package-user fullscreen browser test**

Run:

```bash
pnpm exec vitest run test/expandToolbar.e2e.test.ts -t "complete fullscreen lifecycle"
```

Expected: PASS and exact restoration after exit.

- [ ] **Step 8: Commit the fullscreen fix**

```bash
git add src/runtime/composables/useMermaidFullscreen.ts test/useMermaidFullscreen.test.ts test/fixtures/expand-toolbar/mermaid-stub.ts test/expandToolbar.e2e.test.ts
git commit -m "fix: center Journey diagrams in fullscreen"
```

---

### Task 2: Clip-Aware Expanded Close Transition

**Files:**
- Modify: `test/useMermaidExpand.test.ts`
- Modify: `src/runtime/composables/useMermaidExpand.ts`
- Modify: `src/runtime/components/MermaidExpandOverlay.vue`
- Modify: `src/runtime/built-in-renderer/BuiltInRenderer.vue`
- Modify: `test/fixtures/expand-toolbar/mermaid-stub.ts`
- Modify: `test/expandToolbar.e2e.test.ts`

**Interfaces:**
- Consumes: `getExpandTarget(): SVGElement | null`, `.mermaid-wrapper`, existing zoom state, existing expanded close policies.
- Produces: internal `getExpandViewport(): HTMLElement | null`, `setExpandClipWrap(...)`, `expandClipStyle`, and the existing `expandTargetStyle` redefined for the diagram plane.

- [ ] **Step 1: Extend unit stubs with source viewport geometry**

Create a viewport stub with a bounding rectangle and client box:

```ts
function createViewportStub(rect: { top: number, left: number, width: number, height: number }) {
  return {
    nodeType: 1,
    clientLeft: 0,
    clientTop: 0,
    clientWidth: rect.width,
    clientHeight: rect.height,
    scrollLeft: 1048,
    scrollTop: 0,
    getBoundingClientRect: () => rect,
  }
}
```

Update `setupExpand()` to pass `getExpandViewport` and register separate clip and target elements.

- [ ] **Step 2: Write a failing unit test for the visible right-hand slice**

Use a full SVG rect extending left of a 300px viewport:

```ts
const svgRect = { top: 100, left: -748, width: 1348, height: 240 }
const viewportRect = { top: 100, left: 300, width: 300, height: 240 }
```

Assert the closed geometry before the opening RAF and again immediately after close:

```ts
expect(expand.expandClipStyle.value).toMatchObject({
  top: '100px', left: '300px', width: '300px', height: '240px',
})
expect(expand.expandTargetStyle.value).toMatchObject({
  top: '0px', left: '-1048px', width: '1348px', height: '240px',
  transform: 'translate(0px, 0px) scale(1)',
})
expect(viewport.scrollLeft).toBe(1048)
```

The visible intersection, not `scrollLeft` itself, is authoritative; the offset follows from the measured rectangles.

- [ ] **Step 3: Run the expanded unit test and record RED**

Run:

```bash
pnpm exec vitest run test/useMermaidExpand.test.ts
```

Expected: failure because `getExpandViewport`, `setExpandClipWrap`, and `expandClipStyle` do not exist and the current closed left is the raw `-748px` SVG origin.

- [ ] **Step 4: Introduce explicit clip and diagram metric types**

Replace the flat metric shape with:

```ts
interface ExpandRect {
  top: number
  left: number
  width: number
  height: number
}

interface ExpandMetrics {
  sourceDiagram: ExpandRect
  sourceClip: ExpandRect
  expandedClip: ExpandRect
  sourceOffsetX: number
  sourceOffsetY: number
  translateX: number
  translateY: number
  scale: number
}

interface UseMermaidExpandOptions {
  getExpandTarget: () => SVGElement | null
  getExpandViewport: () => HTMLElement | null
  expandOptions: ExpandOptions
  isBlocked?: Ref<boolean>
}
```

- [ ] **Step 5: Implement client-box intersection measurement**

Add a small pure intersection helper and use the viewport client box:

```ts
function intersectRects(...rects: ExpandRect[]): ExpandRect | null {
  const left = Math.max(...rects.map(rect => rect.left))
  const top = Math.max(...rects.map(rect => rect.top))
  const right = Math.min(...rects.map(rect => rect.left + rect.width))
  const bottom = Math.min(...rects.map(rect => rect.top + rect.height))
  if (right <= left || bottom <= top) return null
  return { top, left, width: right - left, height: bottom - top }
}
```

Build the scroll viewport rect from `getBoundingClientRect()`, `clientLeft`, `clientTop`, `clientWidth`, and `clientHeight`; intersect it with the SVG rect and `{ top: 0, left: 0, width: layoutWidth, height: layoutHeight }`. Return `null` when no visible area exists.

The expanded clip is `{ top: margin, left: margin, width: layoutWidth - margin * 2, height: layoutHeight - margin * 2 }`. Fit the full SVG within that rectangle and make zoom origin equal to the expanded clip's global top/left.

- [ ] **Step 6: Split clip-frame and diagram-plane computed styles**

Add `expandClipWrap` and these state-dependent styles:

```ts
const expandClipStyle = computed<CSSProperties>(() => {
  const metrics = expandMetrics.value
  if (!metrics) return {}
  const rect = isExpanded.value ? metrics.expandedClip : metrics.sourceClip
  return {
    top: `${rect.top}px`, left: `${rect.left}px`,
    width: `${rect.width}px`, height: `${rect.height}px`,
    transitionDuration: shouldDisableTransition.value ? '0ms' : undefined,
  }
})

const expandTargetStyle = computed<CSSProperties>(() => {
  const metrics = expandMetrics.value
  if (!metrics) return {}
  return {
    top: `${isExpanded.value ? 0 : metrics.sourceOffsetY}px`,
    left: `${isExpanded.value ? 0 : metrics.sourceOffsetX}px`,
    width: `${metrics.sourceDiagram.width}px`,
    height: `${metrics.sourceDiagram.height}px`,
    transform: isExpanded.value
      ? zoom.transformStyle.value.transform
      : 'translate(0px, 0px) scale(1)',
    transitionDuration: shouldDisableTransition.value ? '0ms' : undefined,
  }
})
```

Listen for the diagram plane's `transform` transition to complete close, keeping the existing timeout fallback.

- [ ] **Step 7: Render and style the internal clip frame**

Update `MermaidExpandOverlay.vue`:

```html
<div :ref="setExpandClipWrap" class="ncm-expand-clip" :style="expandClipStyle">
  <div
    :ref="setExpandTargetWrap"
    class="ncm-expand-target"
    :class="{ 'ncm-expand-target-with-margin': targetHasMargin }"
    :style="expandTargetStyle"
  />
</div>
```

The clip frame is `position: absolute; overflow: hidden; transition: top 0.3s, left 0.3s, width 0.3s, height 0.3s`. The diagram target is `position: absolute` and transitions `top`, `left`, and `transform`. Apply reduced-motion duration to both layers.

- [ ] **Step 8: Supply the renderer's scroll viewport internally**

Pass the existing template ref without a public prop:

```vue
<MermaidExpandOverlay
  :get-expand-target="getMermaidSvg"
  :get-expand-viewport="() => mermaidWrapper"
  ...
/>
```

Declare `getExpandViewport` only on the private `MermaidExpandOverlay` props and composable options.

- [ ] **Step 9: Run expanded unit tests and confirm GREEN**

Run:

```bash
pnpm exec vitest run test/useMermaidExpand.test.ts
```

Expected: all close policies and cleanup tests still pass, and the scrolled case ends at the visible clip with unchanged `scrollLeft`.

- [ ] **Step 10: Add a wide browser fixture and close-animation assertion**

Make the fixture's SVG wider than `.mermaid-wrapper`, scroll the wrapper to `scrollWidth - clientWidth`, open expanded mode, and sample closing rectangles using `requestAnimationFrame`:

```ts
const result = await page.evaluate(async () => {
  const wrapper = document.querySelector<HTMLElement>('#diagram-root .mermaid-wrapper')!
  wrapper.scrollLeft = wrapper.scrollWidth - wrapper.clientWidth
  const originalScrollLeft = wrapper.scrollLeft
  document.querySelector<HTMLButtonElement>('#diagram-root [aria-label="Expand diagram"]')!.click()
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  document.querySelector<HTMLButtonElement>('[aria-label="Minimize diagram"]')!.click()
  const clip = document.querySelector<HTMLElement>('.ncm-expand-clip')!
  const samples: number[] = []
  for (let index = 0; index < 4; index++) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    samples.push(clip.getBoundingClientRect().left)
  }
  return { originalScrollLeft, currentScrollLeft: wrapper.scrollLeft, samples, sourceLeft: wrapper.getBoundingClientRect().left }
})
expect(result.currentScrollLeft).toBe(result.originalScrollLeft)
expect(Math.min(...result.samples)).toBeGreaterThanOrEqual(result.sourceLeft - 1)
```

Also update selectors from direct `.ncm-expand-target > svg` to `.ncm-expand-clip .ncm-expand-target > svg`.

- [ ] **Step 11: Run expanded browser regression**

Run:

```bash
pnpm exec vitest run test/expandToolbar.e2e.test.ts -t "complete expand lifecycle"
```

Expected: PASS; no flyaway toward the off-screen SVG origin and all prior close/cleanup paths remain green.

- [ ] **Step 12: Commit the clip-aware transition**

```bash
git add src/runtime/composables/useMermaidExpand.ts src/runtime/components/MermaidExpandOverlay.vue src/runtime/built-in-renderer/BuiltInRenderer.vue test/useMermaidExpand.test.ts test/fixtures/expand-toolbar/mermaid-stub.ts test/expandToolbar.e2e.test.ts
git commit -m "fix: close expanded diagrams into visible viewport"
```

---

### Task 3: Parser-Proven Debug Error Fixture

**Files:**
- Create: `test/debugPlayground.e2e.test.ts`
- Modify: `playground/content/test-debug.md`
- Modify: `playground/nuxt.config.ts`

**Interfaces:**
- Consumes: installed Mermaid parser, real Nuxt Content `ContentRenderer`, existing `playground/components/MermaidError.vue` props `{ error: unknown; source: string }`.
- Produces: a debug route whose second diagram deterministically renders the custom detailed error component.

- [ ] **Step 1: Prove an invalid definition with the installed parser**

Use a temporary one-line Node invocation without editing source:

```bash
pnpm exec tsx -e "import mermaid from 'mermaid'; await mermaid.parse('flowchart TD\n  A --')"
```

If that command exits non-zero with a Mermaid parse error, use exactly `flowchart TD\n  A --` in the fixture and test. Do not accept a candidate that parses successfully.

- [ ] **Step 2: Write the failing real browser test**

Create `test/debugPlayground.e2e.test.ts` with the real playground root and browser enabled. Locate the three Mermaid blocks by their surrounding headings and assert:

```ts
const syntaxSection = page.locator('h2', { hasText: 'Syntax Error Chart' }).locator('xpath=following-sibling::*[contains(@class, "mermaid-block")][1]')
await expect.poll(() => syntaxSection.locator('.mermaid-error').count()).toBe(1)
expect(await syntaxSection.locator('svg').count()).toBe(0)
expect(await syntaxSection.textContent()).toContain('Mermaid rendering failed:')
expect(await syntaxSection.locator('details code').textContent()).toContain('A --')
```

Assert the first and third blocks each contain a rendered SVG. Collect `page.on('pageerror')` separately; the intentional Mermaid console diagnostic is allowed only when the route renders the expected error component.

- [ ] **Step 3: Run the debug browser test and record RED**

Run:

```bash
pnpm exec vitest run test/debugPlayground.e2e.test.ts
```

Expected: failure because the current definition parses successfully and the playground has not selected `MermaidError`.

- [ ] **Step 4: Replace the fixture and enable the detailed playground component**

Change the second fence to the parser-proven invalid definition. In the playground-only module options select the existing component:

```ts
components: {
  error: 'MermaidError',
},
```

This changes only the diagnostic playground; it does not change the module's default error component contract.

- [ ] **Step 5: Run the debug browser test and confirm GREEN**

Run:

```bash
pnpm exec vitest run test/debugPlayground.e2e.test.ts
```

Expected: the first and third diagrams render, while the second shows the detailed error message and original invalid source.

- [ ] **Step 6: Commit the debug fixture repair**

```bash
git add playground/content/test-debug.md playground/nuxt.config.ts test/debugPlayground.e2e.test.ts
git commit -m "test: restore Mermaid syntax error fixture"
```

---

### Task 4: Observable Migration Conflict Recovery

**Files:**
- Modify: `playground/pages/migration.vue`
- Modify: `test/migrationPlayground.e2e.test.ts`

**Interfaces:**
- Consumes: existing `recoveryPageConfig`, direct Mermaid config, renderer's one-error-per-conflict-episode behavior.
- Produces: `recoveryDefinition: Ref<string>`, `recoveryPhase: Ref<'direct' | 'conflict' | 'recovered'>`, and `#source-conflict-phase` diagnostic output.

- [ ] **Step 1: Strengthen the migration browser test before the fixture changes**

Add helpers that read the rendered SVG text and ID. Assert this sequence:

```ts
expect(await renderedText()).toContain('DIRECT')
expect(await page.locator('#source-conflict-phase').textContent()).toBe('direct')

await page.locator('#enter-source-conflict').click()
expect(await count()).toBe('1')
expect(await renderedText()).toContain('DIRECT')
expect(await phase()).toBe('conflict')

await page.locator('#enter-source-conflict').click()
expect(await count()).toBe('1')

const beforeRecoveryId = await renderedId()
await page.locator('#recover-source-conflict').click()
await expect.poll(renderedId).not.toBe(beforeRecoveryId)
expect(await renderedText()).toContain('RECOVERED')
expect(await phase()).toBe('recovered')

await page.locator('#enter-source-conflict').click()
expect(await count()).toBe('2')
expect(await renderedText()).toContain('RECOVERED')
```

- [ ] **Step 2: Run the migration browser test and record RED**

Run:

```bash
pnpm exec vitest run test/migrationPlayground.e2e.test.ts
```

Expected: failure because `#source-conflict-phase` does not exist and the static definition is always `CONFLICT → RECOVERED`.

- [ ] **Step 3: Implement distinct batched states in the playground**

Add state:

```ts
type RecoveryPhase = 'direct' | 'conflict' | 'recovered'

const recoveryDefinition = ref('flowchart LR; DIRECT-->ACTIVE')
const recoveryPhase = ref<RecoveryPhase>('direct')
```

Update handlers so Vue batches the related inputs:

```ts
function enterSourceConflict() {
  recoveryDefinition.value = 'flowchart LR; CONFLICT-->BLOCKED'
  recoveryPageConfig.value = conflictPageConfig
  recoveryPhase.value = 'conflict'
}

function recoverSourceConflict() {
  recoveryDefinition.value = 'flowchart LR; RECOVERED-->DIRECT'
  recoveryPageConfig.value = undefined
  recoveryPhase.value = 'recovered'
}
```

Bind the encoded definition through the existing public `code` prop and expose the phase:

```vue
<output id="source-conflict-phase">{{ recoveryPhase }}</output>
<Mermaid
  id="conflict-recovery-example"
  :code="encodeURIComponent(recoveryDefinition)"
  :page-config="recoveryPageConfig"
  :config="recoveryDirectConfig"
  :toolbar="{ title: 'Direct Mermaid Config' }"
/>
```

Keep `onErrorCaptured` unchanged so it continues counting configuration error episodes.

- [ ] **Step 4: Run the migration browser test and confirm GREEN**

Run:

```bash
pnpm exec vitest run test/migrationPlayground.e2e.test.ts
```

Expected: one count during the continuous first conflict, visible recovered output after recovery, then a second count after re-entry while the recovered SVG remains.

- [ ] **Step 5: Commit the migration fixture repair**

```bash
git add playground/pages/migration.vue test/migrationPlayground.e2e.test.ts
git commit -m "test: clarify configuration conflict recovery"
```

---

### Task 5: Integrated Verification and PR Update

**Files:**
- Modify if results changed: PR #84 body only through GitHub CLI.

**Interfaces:**
- Consumes: all four GREEN tasks and existing PR #84 page-config/MDC packaging work.
- Produces: one pushed reviewable branch and complete local/CI evidence in PR #84.

- [ ] **Step 1: Run all focused regressions together**

```bash
pnpm exec vitest run test/useMermaidFullscreen.test.ts test/useMermaidExpand.test.ts test/expandToolbar.e2e.test.ts test/debugPlayground.e2e.test.ts test/migrationPlayground.e2e.test.ts test/builtInRenderer.e2e.test.ts test/componentConfiguration.test.ts test/mdcRuntimePackaging.test.ts
```

Expected: PASS with no skipped new regression.

- [ ] **Step 2: Run required repository verification**

Run each command independently and preserve its exit status and summary:

```bash
pnpm lint
pnpm test
pnpm test:types
pnpm test:package-contract
pnpm dev:build
```

Expected: every command exits 0. If an unrelated pre-existing failure occurs, save the original error and classify it instead of reporting success.

- [ ] **Step 3: Verify the cleaned development playground in a real browser**

Stop only the dev process that belongs to this worktree, then run:

```bash
pnpm exec nuxi cleanup playground
pnpm dev
```

With JavaScript enabled, verify:

- `/mermaid/userjourney/mobile-ordering?type=userJourney`: fullscreen is vertically centered, original `xMinYMin meet` is restored after exit, far-right expanded close returns to the visible slice, and source scroll position is unchanged.
- `/test-debug`: HTTP 200/hydration succeeds, adjacent diagrams render, and the invalid block shows its detailed error component.
- `/migration`: direct → one conflict → visible recovery → second conflict follows the tested episode contract.
- `/`, `/migration-page-config`, and a configured Content route return 200, hydrate, and render SVG.
- No MDC/MDCSlot/MDCRenderer virtual-component 404, catch-all dynamic-import failure, Nuxt 500 page, or unrelated browser console error occurs.

- [ ] **Step 4: Review the final diff and branch scope**

```bash
git status --short --branch
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git log --oneline --decorate origin/main..HEAD
```

Expected: only PR #84 page-config/MDC work, this approved design/plan, the four focused fixes, and their tests/fixtures.

- [ ] **Step 5: Push the existing branch**

```bash
git push origin codex/fix-missing-page-config-ssr
```

- [ ] **Step 6: Update PR #84 body**

Add the four MIA findings, root causes, interaction semantics, RED→GREEN evidence, browser evidence, and all verification command outcomes. Preserve the existing page-config and MDC packaging explanation. State that the dependency/runtime changes require release baseline and MIV re-verification after merge, while this PR does not modify PR #83, RID/MIV records, or release workflow.

- [ ] **Step 7: Wait for every PR #84 GitHub check**

```bash
gh pr checks 84 --watch --interval 15
```

Expected: every required and informational check reaches a terminal result. Report failures verbatim and fix only failures caused by this branch.

- [ ] **Step 8: Final report without merging**

Report confirmed causes, changed files and semantics, RED→GREEN evidence, browser verification, complete local and CI results, commits, PR URL, and remaining MIV/3.0.0 risks. Do not merge, publish, tag, or create a release.
