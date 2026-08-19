# SVG and PNG Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary dual-SVG prototype with one accessible download disclosure that exports the last committed snapshot as sanitized SVG or browser-rasterized PNG.

**Architecture:** The built-in renderer retains one detached SVG snapshot and its committed CSS dimensions. Both formats begin with the same standalone sanitizer; SVG serializes that safe clone, while PNG passes it through a dynamically imported internal deep rasterizer module. The rasterizer owns `html-to-image@1.11.11`, font/resource validation, temporary DOM, transparent rasterization, and cleanup. The module import promise is cached at module scope, so the dependency is absent from initial requests and loaded once on the first PNG action.

**Tech Stack:** Vue 3, TypeScript, Mermaid, `html-to-image@1.11.11`, Font Loading/CSSOM browser APIs, Vitest, Nuxt test-utils, Playwright.

## Global Constraints

- Keep the branch `codex/issue-91-safe-svg-download` and draft PR #113.
- Do not stage or modify the three untracked `temporary-svg-label-stress.md` playground files.
- Add `html-to-image` only as the exact direct dependency `1.11.11`; do not use a semver range or `peerDependencies`.
- Do not expose `html-to-image` types, options, functions, or subpaths through public declarations or package exports.
- Use only the sanitized clone of the last committed SVG snapshot; never re-render Mermaid or modify Mermaid configuration for download.
- Keep sandbox and custom renderers outside the built-in download path.
- Use native disclosure buttons with `aria-expanded` and `aria-controls`; do not use ARIA menu roles or a focus trap.
- Same-origin and anonymous-CORS webfonts must be embedded; an unreadable stylesheet or unembedded font URL must fail before download.
- Do not add retry, delay, browser-specific handling, server rendering, a custom font embedder, alternate SVG output, fallback PNG, or a scale option.
- PNG dimensions equal the committed CSS-pixel dimensions with `pixelRatio: 1`; the canvas remains transparent unless the snapshot contains a background.

---

### Task 1: Lock the dependency contract and remove the second SVG render path

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `test/packageContract.test.ts`
- Modify: `scripts/release-verification/operations.mjs`
- Modify: `test/releaseVerificationOperations.test.ts`
- Modify: `src/runtime/mermaid-rendering.ts`
- Modify: `src/runtime/built-in-renderer/BuiltInRenderer.vue`
- Modify: `test/mermaidRendering.test.ts`
- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify: `test/fixtures/built-in-renderer/mermaid-stub.ts`
- Modify: `test/fixtures/built-in-renderer/types.ts`

**Interfaces:**
- Produces: exact direct dependency contract `html-to-image: "1.11.11"`.
- Produces: `CommittedExportSnapshot { svg: SVGSVGElement, width: number, height: number }`.
- Removes: detached Mermaid download rendering, forced `htmlLabels: false`, source/config export metadata, and the two temporary SVG controls.

- [ ] **Step 1: Write failing package and archive contract tests**

Extend `test/packageContract.test.ts` with exact ownership assertions:

```ts
expect(packageJson.dependencies['html-to-image']).toBe('1.11.11')
expect(packageJson.peerDependencies).not.toHaveProperty('html-to-image')
expect(packageJson.exports).not.toHaveProperty('./png-rasterizer')
```

Extend `assertArchiveDependencyContract()` and its fixtures so the packed
manifest must contain `dependencies.html-to-image === '1.11.11'`. Add one
negative table case using `^1.11.11`; it must fail with
`Archive dependency contract mismatch: dependencies.html-to-image`.

- [ ] **Step 2: Write failing snapshot-only renderer tests**

Restore exact successful render outcomes:

```ts
await expect(requestRender()).resolves.toEqual({ status: 'success' })
```

In built-in E2E coverage, assert that neither temporary SVG control exists and
that no download operation increments the Mermaid stub run count. Keep the
pending, stale, failed, skipped, sandbox, and conflict snapshot assertions.

- [ ] **Step 3: Run RED**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/packageContract.test.ts test/releaseVerificationOperations.test.ts test/mermaidRendering.test.ts test/builtInRenderer.e2e.test.ts
```

Expected: dependency assertions fail; renderer tests expose the expanded
success result and the two temporary controls.

- [ ] **Step 4: Add exact dependencies**

```bash
pnpm add --save-exact html-to-image@1.11.11
pnpm add --save-dev --save-exact @fontsource/noto-sans-tc@5.3.0
```

Confirm `package.json` contains `"html-to-image": "1.11.11"` under
`dependencies`, contains exact `@fontsource/noto-sans-tc` only under
`devDependencies`, and contains neither package under `peerDependencies`.

- [ ] **Step 5: Remove download-time Mermaid rendering**

Change the render outcome to:

```ts
export type MermaidRenderOutcome =
  | { status: 'skipped' }
  | { status: 'stale' }
  | { status: 'success' }
  | { status: 'failure', error: unknown }
```

Delete `MermaidDetachedRenderOptions`, `renderDetachedMermaidSvg`, and the
download-only source/config return values. Keep the existing global Mermaid
queue for visible renders.

Reduce the renderer-owned snapshot to:

```ts
interface CommittedExportSnapshot {
  svg: SVGSVGElement
  width: number
  height: number
}
```

After a successful visible commit, capture a detached SVG clone and positive
`getBoundingClientRect()` width/height. Delete the second SVG handler, its
pending state, warning, filenames, buttons, and stub behavior that existed only
for the removed render path.

- [ ] **Step 6: Run GREEN and commit**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/packageContract.test.ts test/releaseVerificationOperations.test.ts test/mermaidRendering.test.ts test/builtInRenderer.e2e.test.ts
git add package.json pnpm-lock.yaml test/packageContract.test.ts scripts/release-verification/operations.mjs test/releaseVerificationOperations.test.ts src/runtime/mermaid-rendering.ts src/runtime/built-in-renderer/BuiltInRenderer.vue test/mermaidRendering.test.ts test/builtInRenderer.e2e.test.ts test/fixtures/built-in-renderer/mermaid-stub.ts test/fixtures/built-in-renderer/types.ts
git commit -m "refactor: remove alternate SVG rendering"
```

Expected: focused tests pass, the dependency is exact and package-owned, and no
download path can invoke Mermaid.

---

### Task 2: Implement the internal PNG rasterizer with fail-closed fonts

**Files:**
- Create: `src/runtime/png-rasterizer.ts`
- Create: `test/pngRasterizer.test.ts`
- Modify: `src/runtime/svg-download.ts`
- Modify: `test/svgDownload.test.ts`

**Interfaces:**
- Consumes: a sanitized clone of the committed SVG and positive CSS-pixel dimensions.
- Produces: `rasterizePngSnapshot(input): Promise<Blob>` from one internal module.
- Keeps: all `html-to-image` imports and types inside `png-rasterizer.ts`.

- [ ] **Step 1: Write failing rasterizer interface tests**

Use `vi.mock('html-to-image')` and assert only observable module behavior:

```ts
export interface PngRasterizationInput {
  svg: SVGSVGElement
  width: number
  height: number
}

export function rasterizePngSnapshot(
  input: PngRasterizationInput,
): Promise<Blob>
```

Cover these cases separately:

- invalid, zero, infinite, or `NaN` dimensions reject before library calls;
- `document.fonts.ready` settles before `getFontEmbedCSS()`;
- an inaccessible `CSSStyleSheet.cssRules` getter rejects before `toBlob()`;
- a font CSS result containing any non-`data:` `url(...)` rejects before
  `toBlob()` instead of allowing fallback;
- the host passed to `getFontEmbedCSS()` retains the sanitized input's safe
  `foreignObject` content without mutating that input;
- `toBlob()` receives exact width/height/canvasWidth/canvasHeight,
  `pixelRatio: 1`, and the precomputed `fontEmbedCSS`;
- null or non-PNG output rejects;
- temporary host cleanup runs after success and every failure.

- [ ] **Step 2: Write failing shared-download tests**

Extract project-owned helpers from `svg-download.ts`:

```ts
export function createSafeStandaloneSvgClone(
  source: SVGSVGElement,
): SVGSVGElement

export function downloadBlob(blob: Blob, filename: string): void
```

Make `serializeSafeStandaloneSvg()` call `createSafeStandaloneSvgClone()` so
SVG and PNG share exactly one sanitizer and namespace-normalization path.
Assert that it creates one hidden anchor, uses the supplied filename, clicks
once, removes the anchor, and revokes the object URL on the next task. Keep all
existing SVG sanitizer and namespace assertions unchanged.

- [ ] **Step 3: Run RED**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/pngRasterizer.test.ts test/svgDownload.test.ts
```

Expected: imports and functions are missing.

- [ ] **Step 4: Implement the deep rasterizer module**

`png-rasterizer.ts` statically imports only inside the async module:

```ts
import { getFontEmbedCSS, toBlob } from 'html-to-image'
```

Implement these internal phases in order:

1. Validate dimensions.
2. Await `input.svg.ownerDocument.fonts?.ready`.
3. Read every `document.styleSheets[*].cssRules`; wrap a thrown
   `SecurityError` in a package-prefixed rasterization error containing the
   stylesheet URL.
4. Clone the already sanitized input so rasterization cannot mutate the caller's
   safe snapshot.
5. Append the clone to a fixed off-screen host with explicit pixel width/height,
   zero margin/padding, transparent background, and no user interaction.
6. Call `getFontEmbedCSS(host, captureOptions)` once. Parse every `url(...)` in
   the returned font CSS and require `data:` URLs; `local()` without a URL is
   allowed.
7. Call `toBlob(host, { ...captureOptions, fontEmbedCSS })`, where:

```ts
const captureOptions = {
  width,
  height,
  canvasWidth: width,
  canvasHeight: height,
  pixelRatio: 1,
}
```

8. Require a non-null blob with `type === 'image/png'`.
9. Remove the off-screen host in `finally` and never mutate the source SVG.

Do not patch `console`, set `backgroundColor`, call Mermaid, catch-and-return a
fallback blob, or branch by browser.

- [ ] **Step 5: Run GREEN and commit**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/pngRasterizer.test.ts test/svgDownload.test.ts
git add src/runtime/png-rasterizer.ts src/runtime/svg-download.ts test/pngRasterizer.test.ts test/svgDownload.test.ts
git commit -m "feat: rasterize committed SVG snapshots"
```

Expected: all unit contracts pass through the project-owned interface without
exposing package types.

---

### Task 3: Add the disclosure, cached dynamic import, and pending state

**Files:**
- Modify: `src/runtime/built-in-renderer/BuiltInRenderer.vue`
- Modify: `src/runtime/constants.ts`
- Modify: `src/types/mermaid.d.ts`
- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify: `test/expandToolbar.e2e.test.ts`
- Modify: `test/runtimeOptions.test.ts`
- Modify: `test/fixtures/built-in-renderer/nuxt.config.ts`
- Create: `test/fixtures/built-in-renderer/html-to-image-stub.ts`
- Modify: `test/fixtures/expand-toolbar/app.vue`
- Modify: `test/release-verification/consumer-template/type-contracts/package-user.ts`

**Interfaces:**
- Extends: `MermaidToolbarLabels` with `download` and `downloadPng`; retains
  `downloadSvg` for the SVG choice.
- Produces: one module-scope cached `Promise<typeof import('../png-rasterizer')>`.
- Preserves: trigger → SVG → PNG → next toolbar control DOM order.

- [ ] **Step 1: Write failing labels and disclosure tests**

Add literal defaults and type-contract coverage:

```ts
expect(DEFAULT_TOOLBAR_LABELS).toMatchObject({
  download: 'Download diagram',
  downloadSvg: 'Download as SVG',
  downloadPng: 'Download as PNG',
})
```

Assert one native trigger with `aria-expanded="false"`, a valid
`aria-controls`, two native choice buttons after opening, visible choice text,
and no `menu`/`menuitem` roles.

- [ ] **Step 2: Write failing keyboard tests**

Cover the accepted contract with separate tests:

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

Also assert Space opening, PNG → SVG → trigger Shift+Tab behavior, Escape focus
restoration, outside pointer closure without focus movement, and focus return
after either format completes.

- [ ] **Step 3: Write failing lazy-load and loading-state tests**

Alias `html-to-image` in the built-in fixture to a controllable ESM stub. Its
top level increments `window.__htmlToImageModuleEvaluations__`; `toBlob()` waits
on a test-controlled promise and then returns a real `image/png` blob.

Assert:

- initial render and SVG download leave the evaluation count at zero;
- the first PNG click immediately leaves the disclosure open, sets
  `aria-busy="true"`, disables PNG, and shows `.ncm-download-spinner`;
- a second click while pending does nothing;
- releasing the stub creates one download, closes the disclosure, and focuses
  the trigger;
- a later PNG download succeeds with the evaluation count still equal to one;
- a rejected import or rasterization logs one package-prefixed error and creates
  no download.

- [ ] **Step 4: Run RED**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . --test-name "download disclosure|Download as|PNG loading|download keyboard" -- test/builtInRenderer.e2e.test.ts test/expandToolbar.e2e.test.ts test/runtimeOptions.test.ts
```

Expected: missing labels, disclosure, lazy import, and pending-state assertions
fail.

- [ ] **Step 5: Implement the module-scope loader and PNG handler**

Outside component instance state in `BuiltInRenderer.vue`, define:

```ts
type PngRasterizerModule = typeof import('../png-rasterizer')

let pngRasterizerModulePromise: Promise<PngRasterizerModule> | undefined

function loadPngRasterizer(): Promise<PngRasterizerModule> {
  return pngRasterizerModulePromise
    ??= import('../png-rasterizer')
}
```

Do not reset the promise after rejection and do not add preload/prefetch hints.
The component must not have a static runtime import of `png-rasterizer` or
`html-to-image`.

On PNG activation:

1. capture the current `CommittedExportSnapshot`;
2. keep the disclosure open and set `isPngDownloadPending = true` before
   sanitizing or awaiting `loadPngRasterizer()`;
3. create the safe clone with `createSafeStandaloneSvgClone(snapshot.svg)` and
   call `rasterizePngSnapshot()` with that clone and the captured dimensions;
4. pass the blob to `downloadBlob(blob, 'mermaid-diagram.png')`;
5. on error, log one `[nuxt-content-mermaid] Failed to download PNG:` error;
6. in `finally`, clear pending, close, and focus the trigger if still connected.

- [ ] **Step 6: Implement disclosure markup and styling**

Add the trigger directly after Copy and before Expand. Use `useId()`, native
buttons, natural DOM order, `v-if` disclosure content, focusout closure, Escape,
and outside `pointerdown` cleanup.

The pending PNG button uses:

```vue
<button
  type="button"
  :disabled="isPngDownloadPending"
  :aria-busy="isPngDownloadPending || undefined"
>
  <span
    v-if="isPngDownloadPending"
    class="ncm-download-spinner"
    aria-hidden="true"
  />
  {{ downloadPngLabel }}
</button>
```

Style only the small disclosure and spinner with existing color/size variables.
Do not add animation beyond the spinner rotation or introduce a new public
option.

- [ ] **Step 7: Run GREEN and commit**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/builtInRenderer.e2e.test.ts test/expandToolbar.e2e.test.ts test/runtimeOptions.test.ts test/svgDownload.test.ts
git add src/runtime/built-in-renderer/BuiltInRenderer.vue src/runtime/constants.ts src/types/mermaid.d.ts test/builtInRenderer.e2e.test.ts test/expandToolbar.e2e.test.ts test/runtimeOptions.test.ts test/fixtures/built-in-renderer/nuxt.config.ts test/fixtures/built-in-renderer/html-to-image-stub.ts test/fixtures/expand-toolbar/app.vue test/release-verification/consumer-template/type-contracts/package-user.ts
git commit -m "feat: download diagrams as SVG or PNG"
```

Expected: disclosure, keyboard, labels, lazy loading, pending state, snapshot
coherence, and download behavior pass.

---

### Task 4: Add the three-engine visual regression gate

**Files:**
- Create: `test/fixtures/png-rasterizer/nuxt.config.ts`
- Create: `test/fixtures/png-rasterizer/app.vue`
- Create: `test/fixtures/png-rasterizer/committed-mermaid-snapshot.svg`
- Create: `test/fixtures/png-rasterizer/server/routes/fixture-fonts.css.ts`
- Create: `test/fixtures/png-rasterizer/server/routes/files/[font].ts`
- Create: `test/helpers/fontFixtureServer.ts`
- Create: `test/pngRasterizer.browser.test.ts`

**Interfaces:**
- Consumes: the real `rasterizePngSnapshot()` and fixed sanitized Mermaid SVG
  SHA-256 `c717f5d969335af8dccf16ff8cc011491f3317137f054597a438e6adfffea493`.
- Produces: one result per engine/resource mode with semantic gates, hashes, and
  adjacent perceptual pixel differences.

- [ ] **Step 1: Commit the fixed regression fixture**

Add the already sanitized committed SVG used by the bounded spike. Verify its
SHA-256 before staging and keep these exact feature counts in the test:

```ts
expect(features).toEqual({
  foreignObjectCount: 11,
  chineseForeignObjects: 9,
  multilineForeignObjects: 8,
  boldForeignObjects: 8,
})
```

The same-origin Nuxt routes serve Noto Sans TC 400/700 Traditional Chinese and
Latin WOFF2 files from `@fontsource/noto-sans-tc@5.3.0`. The helper server
provides two cross-origin modes: anonymous CORS with
`Access-Control-Allow-Origin: *`, and an opaque stylesheet whose font URLs point
to the CORS-enabled server so the live page can render the font while the
rasterizer must reject unreadable CSSOM.

- [ ] **Step 2: Implement the deterministic browser harness**

The fixture app imports the internal rasterizer, mounts only the parsed fixed
snapshot, and runs three sequential rasterizations. It records PNG pixels,
dimensions, corner alpha, feature regions, font metrics, and diagnostic SHA-256
hashes without invoking Mermaid.

Use this exact pixel predicate:

```ts
const CHANNEL_DELTA = 8
const MAX_DIFFERING_PIXEL_RATIO = 0.0001

const differs =
  Math.abs(a.r - b.r) > CHANNEL_DELTA
  || Math.abs(a.g - b.g) > CHANNEL_DELTA
  || Math.abs(a.b - b.b) > CHANNEL_DELTA
  || Math.abs(a.a - b.a) > CHANNEL_DELTA

expect(differentPixels / comparedPixels)
  .toBeLessThan(MAX_DIFFERING_PIXEL_RATIO)
```

Compare run 1 → 2 and run 2 → 3. Store hashes only in failure diagnostics; do
not assert hash equality.

- [ ] **Step 3: Run Chromium, Firefox, and WebKit from Vitest**

Use `setup({ browser: false, build: true, dev: false, server: true })` once, then
launch `chromium`, `firefox`, and `webkit` directly from `playwright`. For each
engine, run same-origin and anonymous-CORS modes and assert:

- exact 1445×477 dimensions on all three outputs;
- four transparent corner alpha values;
- nonblank `foreignObject`, Chinese, multiline, and bold feature regions;
- loaded Noto Sans TC metrics differ from the fallback control;
- no console/resource error or warning;
- both adjacent perceptual ratios are below 0.0001.

Run the blocked mode in every engine and assert `success: false`, a stylesheet
readability error, and no PNG blob/download.

- [ ] **Step 4: Run the browser gate and commit**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/pngRasterizer.browser.test.ts
git add test/fixtures/png-rasterizer test/helpers/fontFixtureServer.ts test/pngRasterizer.browser.test.ts
git commit -m "test: verify PNG fidelity across browser engines"
```

Expected: six positive engine/mode cases pass and all three blocked cases fail
explicitly without fallback output.

---

### Task 5: Prove production async-chunk loading

**Files:**
- Create: `test/fixtures/png-download-build/nuxt.config.ts`
- Create: `test/fixtures/png-download-build/app.vue`
- Create: `test/pngAsyncChunk.e2e.test.ts`

**Interfaces:**
- Consumes: a production Nuxt build using the real built-in renderer and real
  `html-to-image@1.11.11`.
- Produces: static asset inspection plus request-timeline evidence for first and
  repeated PNG actions.

- [ ] **Step 1: Create the production fixture and failing build test**

Build the fixture through:

```ts
await setup({
  rootDir,
  browser: false,
  build: true,
  dev: false,
  server: true,
  setupTimeout: 180_000,
})
```

The fixture renders one built-in SVG diagram with SVG/PNG disclosure enabled.
After build, scan `.output/public/_nuxt/*.js` and identify the asset containing
the `html-to-image@1.11.11` diagnostic string `Error inlining remote css file`.
Assert exactly one asynchronous asset contains it and no initial HTML or public
declaration contains `html-to-image`.

- [ ] **Step 2: Assert the production request timeline**

Launch Chromium and register `page.on('request')` before navigation. Assert:

1. initial navigation, hydration, and diagram render do not request the
   identified asset;
2. no `preload` or `modulepreload` link references it;
3. opening the disclosure does not request it;
4. choosing SVG downloads `mermaid-diagram.svg` without requesting it;
5. the first PNG click shows `aria-busy="true"` and disabled state, requests
   the asset, and downloads `mermaid-diagram.png`;
6. a second PNG download succeeds while the asset request count remains one.

Also run `pnpm prepack`, read `dist/types.d.mts`, and assert it contains no
`html-to-image` string and exposes no PNG rasterizer subpath.

- [ ] **Step 3: Run the production gate and commit**

```bash
python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/pngAsyncChunk.e2e.test.ts
pnpm prepack
git add test/fixtures/png-download-build test/pngAsyncChunk.e2e.test.ts
git commit -m "test: verify lazy PNG production chunk"
```

Expected: the library is absent from the initial request graph and fetched once
on the first PNG action.

---

### Task 6: Update user documentation, verify, and refresh the draft PR

**Files:**
- Modify: `website/content/4.configuration.md`
- Modify: `website/content/5.advanced/3.interactions.md`
- Modify: `website/content/zh/4.configuration.md`
- Modify: `website/content/zh/5.advanced/3.interactions.md`
- Modify: draft PR #113 title and body after all local gates pass

- [ ] **Step 1: Update English and Chinese documentation**

Document the three label keys, disclosure/keyboard behavior, committed-snapshot
SVG/PNG distinction, transparent PNG behavior, first-use loading state, exact
failure behavior for blocked webfonts, and lazy dependency loading. State that
`htmlLabels: false` is the user-controlled way to obtain native SVG text.

Use this Chinese example:

```ts
labels: {
  download: '下載圖片',
  downloadSvg: '下載成 SVG',
  downloadPng: '下載成 PNG',
}
```

- [ ] **Step 2: Run complete verification**

```bash
pnpm lint --fix
pnpm test
pnpm test:types
pnpm test:package-contract
pnpm dev:build
pnpm --dir website test
git diff --check
if rg -n "Download faithful SVG|Download portable SVG|mermaid-diagram-faithful|mermaid-diagram-portable|renderDetachedMermaidSvg|downloadPortableSvg" src test website; then exit 1; fi
git status --short
```

Expected: every command exits 0; the final `rg` returns no obsolete
implementation or user-facing terminology; `git status --short` retains the
user's three untracked stress fixtures and does not stage generated `dist`.

- [ ] **Step 3: Commit documentation**

```bash
git add website/content/4.configuration.md website/content/5.advanced/3.interactions.md website/content/zh/4.configuration.md website/content/zh/5.advanced/3.interactions.md
git commit -m "docs: explain SVG and PNG downloads"
```

- [ ] **Step 4: Update the draft PR**

Confirm the branch diff contains only the approved SVG/PNG feature, exact
dependency, internal rasterizer, tests, and documentation. Push
`codex/issue-91-safe-svg-download`, keep PR #113 draft, and replace its prototype
title/body with:

- the one-trigger SVG/PNG contract;
- exact `html-to-image@1.11.11` ownership and lazy-loading behavior;
- browser perceptual-diff and CORS evidence;
- production async-chunk evidence;
- complete verification commands;
- `Closes #91` only after every gate passes.
