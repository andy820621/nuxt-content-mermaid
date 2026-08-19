# SVG and PNG Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary dual-SVG prototype with one accessible download disclosure that exports the last committed snapshot as SVG or browser-rasterized PNG.

**Architecture:** The built-in renderer retains one detached SVG snapshot and its committed CSS dimensions. SVG export serializes that snapshot; PNG export waits for fonts, loads the same serialized snapshot as an image, and draws it to a transparent canvas. No final export path calls Mermaid.

**Tech Stack:** Vue 3, TypeScript, Mermaid, Canvas/Image/Font Loading browser APIs, Vitest, Nuxt test-utils, Playwright CLI.

## Global Constraints

- Keep the branch `codex/issue-91-safe-svg-download` and draft PR #113.
- Do not stage or modify the three untracked `temporary-svg-label-stress.md` playground files.
- Use only native browser APIs; add no runtime or development dependency.
- Preserve user Mermaid settings and never re-render for download.
- Keep sandbox and custom renderers outside the built-in download path.
- Use disclosure semantics with native buttons, `aria-expanded`, and `aria-controls`; do not use ARIA menu roles or a focus trap.
- Stop and report evidence if Chromium, Firefox, or WebKit fails the `foreignObject`, loaded-font, transparency, or dimension probe.
- Do not add a fallback, server renderer, font embedder, scale option, or browser-specific branch.

---

### Task 1: Prove the native rasterization primitive in all target engines

**Files:**
- Create temporarily, never stage: `output/playwright/svg-png-probe.html`
- Preserve: `playground/content/mermaid/**/temporary-svg-label-stress.md`

**Interfaces:**
- Consumes: Blob URL, `Image.decode()`, canvas, `document.fonts.ready`, `XMLSerializer`.
- Produces: one result object per engine with `foreignObject`, `font`, `transparent`, and `dimensions` booleans.

- [ ] **Step 1: Create the disposable probe**

Create the probe through `apply_patch`. It must:

1. load `node_modules/.pnpm/katex@0.16.47/node_modules/katex/dist/fonts/KaTeX_Typewriter-Regular.woff2` from the local static server with `@font-face`;
2. render a 240×120 SVG containing XHTML `foreignObject` labels `MMMM` and `iiii` in different colors using that font;
3. await `document.fonts.load('24px NcmProbeFont')` and `document.fonts.ready`;
4. clone and XML-serialize the SVG, load it through a Blob URL, and draw it to an unfilled 240×120 canvas;
5. compare colored glyph bounds so `MMMM` and `iiii` remain approximately equal-width in the monospaced web font;
6. verify colored label pixels exist, the top-left alpha is zero, and the canvas dimensions are 240×120;
7. publish only this literal contract:

```js
window.__ncmProbe = {
  foreignObject: redPixels > 0 && bluePixels > 0,
  font: Math.abs(redBounds.width - blueBounds.width) <= 4,
  transparent: pixels[3] === 0,
  dimensions: canvas.width === 240 && canvas.height === 120,
}
```

- [ ] **Step 2: Serve the probe and run Playwright CLI**

Run a local static server from the repository root, then run separate sessions:

```bash
command -v npx
python3 -m http.server 4178 --bind 127.0.0.1
PWCLI=/Users/Andy/.codex/skills/playwright/scripts/playwright_cli.sh
"$PWCLI" -s=ncm-png-chrome open http://127.0.0.1:4178/output/playwright/svg-png-probe.html --browser=chrome
"$PWCLI" -s=ncm-png-firefox open http://127.0.0.1:4178/output/playwright/svg-png-probe.html --browser=firefox
"$PWCLI" -s=ncm-png-webkit open http://127.0.0.1:4178/output/playwright/svg-png-probe.html --browser=webkit
"$PWCLI" -s=ncm-png-chrome eval '() => window.__ncmProbe'
"$PWCLI" -s=ncm-png-firefox eval '() => window.__ncmProbe'
"$PWCLI" -s=ncm-png-webkit eval '() => window.__ncmProbe'
```

Expected from every engine:

```json
{"foreignObject":true,"font":true,"transparent":true,"dimensions":true}
```

If any value is false or decoding/drawing throws, take a Playwright screenshot for that engine, retain the probe under `output/playwright/`, report the exact result/error, and stop before Task 2.

- [ ] **Step 3: Clean up a passing probe**

Close the three Playwright sessions, stop the server, and delete the temporary probe with `apply_patch`. Confirm `git status --short` still shows only the user's three untracked playground files.

No commit is created for this gate.

---

### Task 2: Remove the portable render path and restore a snapshot-only renderer contract

**Files:**
- Modify: `src/runtime/mermaid-rendering.ts`
- Modify: `src/runtime/built-in-renderer/BuiltInRenderer.vue`
- Modify: `test/mermaidRendering.test.ts`
- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify: `test/fixtures/built-in-renderer/mermaid-stub.ts`
- Modify: `test/fixtures/built-in-renderer/types.ts`

**Interfaces:**
- Produces: `CommittedExportSnapshot { svg: SVGSVGElement, width: number, height: number }`.
- Removes: `MermaidDetachedRenderOptions`, `renderDetachedMermaidSvg`, portable download state, forced `htmlLabels: false`, and success-result `source/config` metadata.

- [ ] **Step 1: Write the failing contract tests**

Change renderer unit expectations back to exact success outcomes:

```ts
await expect(requestRender()).resolves.toEqual({ status: 'success' })
```

Change built-in E2E expectations so the toolbar has no `Download faithful SVG` or `Download portable SVG` controls and no download action increases the Mermaid stub run count.

The production mutations caught are: retaining source/config solely for export, leaving detached Mermaid render callable, or keeping either temporary control.

- [ ] **Step 2: Run RED**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/mermaidRendering.test.ts test/builtInRenderer.e2e.test.ts
```

Expected: failures show the expanded success result and temporary portable/faithful controls still exist.

- [ ] **Step 3: Remove portable implementation**

Make the success type and return value snapshot-agnostic:

```ts
export type MermaidRenderOutcome =
  | { status: 'success' }
  | { status: 'stale' }
  | { status: 'failure', error: unknown }
```

Delete `renderDetachedMermaidSvg` and its exported options. Keep the single global Mermaid queue used by visible renders.

In `BuiltInRenderer.vue`, reduce the snapshot to:

```ts
interface CommittedExportSnapshot {
  svg: SVGSVGElement
  width: number
  height: number
}
```

After a successful commit, read the committed SVG rectangle and store a detached clone plus its positive CSS dimensions. Delete `isPortableDownloadPending`, `downloadPortableSvg`, the residual-`foreignObject` warning, and both experimental buttons.

Simplify the stub by removing `htmlLabels` export-run tracking that only served the prototype, while retaining unsafe-label fixtures needed by standalone SVG tests.

- [ ] **Step 4: Run GREEN and commit**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/mermaidRendering.test.ts test/builtInRenderer.e2e.test.ts
git add src/runtime/mermaid-rendering.ts src/runtime/built-in-renderer/BuiltInRenderer.vue test/mermaidRendering.test.ts test/builtInRenderer.e2e.test.ts test/fixtures/built-in-renderer/mermaid-stub.ts test/fixtures/built-in-renderer/types.ts
git commit -m "refactor: remove portable SVG rendering"
```

Expected: focused tests pass and no Mermaid download re-render remains.

---

### Task 3: Add the download disclosure and snapshot PNG encoder with TDD

**Files:**
- Create: `src/runtime/png-download.ts`
- Modify: `src/runtime/svg-download.ts`
- Modify: `src/runtime/built-in-renderer/BuiltInRenderer.vue`
- Modify: `src/runtime/constants.ts`
- Modify: `src/types/mermaid.d.ts`
- Modify: `test/svgDownload.test.ts`
- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify: `test/expandToolbar.e2e.test.ts`
- Modify: `test/runtimeOptions.test.ts`
- Modify: `test/fixtures/expand-toolbar/app.vue`
- Modify: `test/release-verification/consumer-template/type-contracts/package-user.ts`

**Interfaces:**
- Produces: `createPngBlobFromSvgSnapshot(source, size): Promise<Blob>` and `downloadStandalonePng(source, size): Promise<void>` as internal runtime utilities.
- Extends: `MermaidToolbarLabels` with `download` and `downloadPng`; keeps `downloadSvg` as the SVG choice.

- [ ] **Step 1: Write failing label and disclosure tests**

Add literal label expectations:

```ts
expect(DEFAULT_TOOLBAR_LABELS).toMatchObject({
  download: 'Download diagram',
  downloadSvg: 'Download as SVG',
  downloadPng: 'Download as PNG',
})
```

Add E2E assertions for one trigger and disclosure content:

```ts
const trigger = root.getByLabel('Download diagram')
expect(await trigger.getAttribute('aria-expanded')).toBe('false')
const controls = await trigger.getAttribute('aria-controls')
expect(controls).toBeTruthy()
expect(await page.locator(`#${controls}`).count()).toBe(0)
```

Open it and assert the controlled element contains two native buttons, visible text, no `role="menu"`, and no `role="menuitem"`.

- [ ] **Step 2: Write failing keyboard tests**

Cover the approved contract as separate behaviors:

```ts
await trigger.focus()
await page.keyboard.press('Enter')
expect(await activeLabel(page)).toBe('Download as SVG')
await page.keyboard.press('Tab')
expect(await activeLabel(page)).toBe('Download as PNG')
await page.keyboard.press('Tab')
expect(await activeLabel(page)).toBe('Expand diagram')
expect(await trigger.getAttribute('aria-expanded')).toBe('false')
```

Also assert:

- Space opens and focuses SVG;
- Shift+Tab moves PNG → SVG → trigger and closes;
- Escape closes and focuses trigger;
- outside pointer click closes without moving focus;
- SVG and PNG selection close and focus trigger after the download event.

The production mutations caught are wrong DOM order, a focus trap, forced trigger restoration on Tab, missing Escape restoration, or ARIA menu semantics.

- [ ] **Step 3: Write failing SVG/PNG behavior tests**

For SVG, assert filename `mermaid-diagram.svg`, preserved `foreignObject` text, safe standalone XML, and no extra Mermaid run.

For PNG, use the real browser download and assert:

- filename `mermaid-diagram.png`;
- PNG magic bytes `89504e470d0a1a0a`;
- IHDR width and height equal `Math.ceil(committedDimension * devicePixelRatio)`;
- decoding the downloaded bytes back into an image produces transparent corner pixels and non-transparent diagram/label pixels;
- Mermaid run count and visible SVG identity do not change.

Retain the existing pending/stale/failure snapshot tests and make both choices export the same last committed run.

- [ ] **Step 4: Run RED**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . --test-name "download disclosure|Download as|PNG snapshot|keyboard" -- test/builtInRenderer.e2e.test.ts test/expandToolbar.e2e.test.ts test/runtimeOptions.test.ts test/svgDownload.test.ts
```

Expected: failures identify missing labels, trigger/disclosure, PNG helper, filenames, and keyboard behavior.

- [ ] **Step 5: Implement the PNG utility**

In `png-download.ts`, implement this exact internal shape:

```ts
export interface SvgSnapshotSize {
  width: number
  height: number
}

export async function createPngBlobFromSvgSnapshot(
  source: SVGSVGElement,
  size: SvgSnapshotSize,
): Promise<Blob>

export async function downloadStandalonePng(
  source: SVGSVGElement,
  size: SvgSnapshotSize,
): Promise<void>
```

Validate finite positive dimensions, await `source.ownerDocument.fonts?.ready`, clone the source with explicit pixel `width` and `height`, serialize it through `serializeSafeStandaloneSvg`, decode a Blob URL with the owner window's `Image`, and draw it to an unfilled canvas. Use a finite positive `devicePixelRatio` or `1`, reject a missing 2D context or null `toBlob`, and revoke the SVG URL in `finally`.

Extract one internal Blob download helper from `svg-download.ts` so SVG and PNG share anchor creation, filename assignment, removal, and delayed URL revocation. Keep SVG sanitization and `foreignObject` normalization unchanged.

- [ ] **Step 6: Implement labels and disclosure**

Add defaults:

```ts
download: 'Download diagram',
downloadSvg: 'Download as SVG',
downloadPng: 'Download as PNG',
```

In `BuiltInRenderer.vue`, add one relative disclosure wrapper directly after Copy and before Expand. Use `useId()` for the controlled ID, native buttons in trigger → SVG → PNG DOM order, and `v-if` for the disclosure content.

Implement:

- trigger toggle with `aria-expanded`/`aria-controls`;
- keyboard-origin open (`MouseEvent.detail === 0`) followed by `nextTick()` focus on SVG;
- disclosure `focusout` closure when `relatedTarget` leaves the disclosure;
- Escape closure plus trigger focus;
- document `pointerdown` outside closure without focus;
- SVG and awaited PNG handlers that capture the snapshot, close, and focus trigger after completion or error;
- one PNG-in-flight guard and one package-prefixed PNG error;
- automatic closure when export eligibility is lost and listener cleanup on unmount.

Style only a small absolute popover and its visible text buttons using existing `--ncm-*` variables. Do not add animation, a selector component, or new CSS variables.

- [ ] **Step 7: Run GREEN and commit**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/builtInRenderer.e2e.test.ts test/expandToolbar.e2e.test.ts test/runtimeOptions.test.ts test/svgDownload.test.ts
git add src/runtime/png-download.ts src/runtime/svg-download.ts src/runtime/built-in-renderer/BuiltInRenderer.vue src/runtime/constants.ts src/types/mermaid.d.ts test/svgDownload.test.ts test/builtInRenderer.e2e.test.ts test/expandToolbar.e2e.test.ts test/runtimeOptions.test.ts test/fixtures/expand-toolbar/app.vue test/release-verification/consumer-template/type-contracts/package-user.ts
git commit -m "feat: download diagrams as SVG or PNG"
```

Expected: disclosure, keyboard, SVG, PNG, labels, and snapshot tests pass.

---

### Task 4: Preserve renderer boundaries and verify the production encoder

**Files:**
- Modify: `test/customRenderer.e2e.test.ts`
- Modify: `test/migrationPlayground.e2e.test.ts`
- Reuse temporarily: `output/playwright/svg-png-probe.html`

**Interfaces:**
- Consumes: final built-in disclosure and `dist/runtime/png-download.js`.
- Produces: boundary coverage plus three-engine evidence for the production implementation.

- [ ] **Step 1: Add failing boundary assertions**

Assert custom renderers expose no `Download diagram` trigger. Assert sandbox diagrams keep the trigger disabled and cannot open the disclosure. Update the real Mermaid finance-ledger test to download SVG and PNG from one visible `foreignObject` diagram and assert no second Mermaid render or visible replacement.

- [ ] **Step 2: Run RED, make only boundary corrections, and run GREEN**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/customRenderer.e2e.test.ts test/builtInRenderer.e2e.test.ts test/migrationPlayground.e2e.test.ts
```

If production code already satisfies the assertions, no production change is needed. Otherwise correct only visibility/disabled guards and rerun the same command.

- [ ] **Step 3: Build and exercise the actual encoder in three engines**

Run `pnpm prepack`. Recreate the probe so it imports `createPngBlobFromSvgSnapshot` from `/dist/runtime/png-download.js`, then repeat the Task 1 Chrome, Firefox, and WebKit sessions and exact result assertions.

Expected: all four booleans are true in all engines. On failure, stop, retain artifacts, and report evidence without adding a fallback.

- [ ] **Step 4: Commit boundary tests**

Delete the passing temporary probe, confirm it is not staged, then:

```bash
git add test/customRenderer.e2e.test.ts test/migrationPlayground.e2e.test.ts test/builtInRenderer.e2e.test.ts
git commit -m "test: verify snapshot downloads across renderer boundaries"
```

---

### Task 5: Replace prototype documentation, verify, and update the draft PR

**Files:**
- Modify: `website/content/4.configuration.md`
- Modify: `website/content/5.advanced/3.interactions.md`
- Modify: `website/content/zh/4.configuration.md`
- Modify: `website/content/zh/5.advanced/3.interactions.md`
- Delete: `docs/superpowers/plans/2026-08-19-svg-download-strategy-prototype.md`
- Delete: `docs/superpowers/specs/2026-08-19-svg-download-strategy-prototype-design.md`

- [ ] **Step 1: Update final user documentation**

Document the three label keys, disclosure behavior, snapshot-based SVG/PNG distinction, PNG transparency, and the keyboard contract. State that `htmlLabels: false` is the user-controlled way to obtain native SVG text and keeps visible/downloaded SVG structure aligned. Remove all faithful/portable terminology and forced-re-render claims.

Use this Chinese example:

```ts
labels: {
  download: '下載圖片',
  downloadSvg: '下載成 SVG',
  downloadPng: '下載成 PNG',
}
```

- [ ] **Step 2: Remove obsolete prototype documents and commit**

Delete only the two 2026-08-19 prototype documents listed above; retain the approved final design and this plan.

```bash
git add website/content/4.configuration.md website/content/5.advanced/3.interactions.md website/content/zh/4.configuration.md website/content/zh/5.advanced/3.interactions.md docs/superpowers/plans/2026-08-19-svg-download-strategy-prototype.md docs/superpowers/specs/2026-08-19-svg-download-strategy-prototype-design.md
git commit -m "docs: explain SVG and PNG downloads"
```

- [ ] **Step 3: Run complete verification**

```bash
pnpm lint --fix
pnpm test
pnpm test:types
pnpm test:package-contract
pnpm dev:build
pnpm --dir website test
git diff --check
git status --short
```

Expected: every command exits 0; `git status --short` contains only the user's three untracked stress-test files; generated `dist` is not staged.

- [ ] **Step 4: Inspect scope and publish**

Confirm the branch diff contains no dependency, server renderer, scale option, fallback, or unrelated playground change. Push `codex/issue-91-safe-svg-download`, keep PR #113 draft, and update its title/body to the final SVG/PNG contract, exact validation evidence, browser matrix, and `Closes #91` only after all gates pass.
