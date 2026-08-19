# Dual SVG Download Strategy Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two temporary, clearly identified SVG downloads so the reviewer can compare a browser-faithful export that preserves HTML labels with a portability-oriented export re-rendered with root-level `htmlLabels: false`.

**Architecture:** The built-in renderer keeps one internal snapshot of the last successfully committed generation: its source, invocation-owned effective Mermaid configuration, and detached SVG clone. Faithful export sanitizes and serializes that SVG without another Mermaid render. Portable export captures the same snapshot at click time, overrides only root `htmlLabels` on a fresh config root, and renders in a detached host through the existing global Mermaid queue before applying the same standalone serializer. Neither path commits into the visible diagram.

**Tech Stack:** TypeScript, Vue 3 `<script setup>`, Mermaid 11, Nuxt Content, Vitest, `@nuxt/test-utils`, and Playwright.

## Global Constraints

- Keep visible rendering behavior and the effective `htmlLabels: true` default unchanged; continue respecting a user's visible-render override.
- Export only the last successfully committed generation. Pending, stale, failed, skipped, and conflicting inputs must not replace it.
- Keep both controls experimental and internal. Do not add module options, public types, localization keys, production documentation, release notes, or final issue #91 wording.
- Keep `securityLevel: 'sandbox'` and custom-renderer diagrams outside the built-in SVG download path.
- Preserve the current active-content and external-resource removals. The faithful prototype changes only the blanket removal of `foreignObject` and adds standalone namespace/overflow normalization.
- Do not bind Mermaid interactions or mutate copy, expand, fullscreen, zoom, loading, error, or visible SVG state during export.
- If a portable render still contains `foreignObject`, preserve it as evidence and emit a focused warning; do not silently delete the remaining label.
- Do not add an HTML-to-SVG converter, text-to-path conversion, raster fallback, permanent format selector, or generated `dist` files.
- Work on `codex/issue-91-safe-svg-download` and keep draft PR #113 as the review surface.

---

## Task 1: Make the existing download the faithful candidate

**Files:**

- Modify: `test/fixtures/built-in-renderer/mermaid-stub.ts`
- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify: `src/runtime/svg-download.ts`
- Modify: `src/runtime/built-in-renderer/BuiltInRenderer.vue`

- [ ] **Step 1: Write the failing faithful-export assertions**

Change the unsafe stub label into representative XHTML content while retaining the existing unsafe SVG elements:

~~~ts
<foreignObject>
  <div xmlns="http://www.w3.org/1999/xhtml" onclick="alert(1)">
    <strong>foreign content</strong>
  </div>
</foreignObject>
~~~

Extend `readLatestSvgDownload` to return these structural facts:

~~~ts
activeElements: document.querySelectorAll('script, iframe, object, embed').length,
foreignObjects: document.querySelectorAll('foreignObject').length,
foreignObjectText: document.querySelector('foreignObject')?.textContent?.trim(),
foreignObjectOverflow: document.querySelector('foreignObject')?.getAttribute('overflow'),
xhtmlNamespace: document.querySelector('foreignObject > *')?.namespaceURI,
~~~

Update the sanitizer integration test to click `[aria-label="Download faithful SVG"]` and assert:

~~~ts
expect(capture).toMatchObject({
  type: 'image/svg+xml;charset=utf-8',
  namespace: 'http://www.w3.org/2000/svg',
  activeElements: 0,
  foreignObjects: 1,
  foreignObjectText: 'foreign content',
  foreignObjectOverflow: 'visible',
  xhtmlNamespace: 'http://www.w3.org/1999/xhtml',
  anchors: 0,
  eventAttributes: 0,
  unsafeResourceAttributes: 0,
  safeStyleCount: 1,
  unsafeStyleCount: 0,
  linkLabelPreserved: 'Link label',
  safePaint: 'url(#paint)',
  safeUse: '#safe-shape',
})
expect(
  await page.evaluate(() => {
    return (window as MermaidTestWindow).__mermaidControl__?.runs.length
  }),
).toBe(2)
~~~

The last assertion establishes that the faithful click does not invoke Mermaid again.

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run:

~~~bash
pnpm vitest run test/builtInRenderer.e2e.test.ts -t "sanitizes a detached clone"
~~~

Expected: failure because the control still uses the old name and `sanitizeSvgClone` removes `foreignObject`.

- [ ] **Step 3: Preserve and normalize trusted label containers**

In `src/runtime/svg-download.ts`:

1. Change `BLOCKED_ELEMENTS` to `script, iframe, object, embed`.
2. Add `XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'`.
3. Normalize each retained `foreignObject` after sanitization:

~~~ts
function normalizeForeignObjectLabels(svg: SVGSVGElement) {
  for (const foreignObject of svg.querySelectorAll('foreignObject')) {
    foreignObject.setAttribute('overflow', 'visible')
    foreignObject.firstElementChild?.setAttributeNS(
      XMLNS_NAMESPACE,
      'xmlns',
      XHTML_NAMESPACE,
    )
  }
}
~~~

4. Call `normalizeForeignObjectLabels(clone)` before `XMLSerializer`.
5. Let callers provide a filename without changing the existing default:

~~~ts
interface SvgDownloadOptions {
  filename?: string
}

export function downloadStandaloneSvg(
  source: SVGSVGElement,
  options: SvgDownloadOptions = {},
): void {
  const filename = options.filename ?? SVG_DOWNLOAD_FILENAME
  const blob = new Blob(
    [serializeSafeStandaloneSvg(source)],
    { type: SVG_DOWNLOAD_MIME_TYPE },
  )
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
~~~

- [ ] **Step 4: Rename the temporary faithful control**

In `BuiltInRenderer.vue`, keep the current `downloadableSvg` state for this task and replace `downloadLatestSvg` with:

~~~ts
function downloadFaithfulSvg() {
  if (!canDownloadSvg.value || !downloadableSvg.value) return
  downloadStandaloneSvg(downloadableSvg.value, {
    filename: 'mermaid-diagram-faithful.svg',
  })
}
~~~

Set the button's `title` and `aria-label` to `Download faithful SVG` and call `downloadFaithfulSvg`. Do not add a public label key.

- [ ] **Step 5: Re-run the focused tests**

Run:

~~~bash
pnpm vitest run test/builtInRenderer.e2e.test.ts -t "downloads|sanitizes"
~~~

Expected: both tests pass; the suggested filename is `mermaid-diagram-faithful.svg`, XHTML label text survives, unsafe content is absent, and the visible SVG is unchanged.

- [ ] **Step 6: Commit the faithful candidate**

~~~bash
git add src/runtime/svg-download.ts src/runtime/built-in-renderer/BuiltInRenderer.vue test/fixtures/built-in-renderer/mermaid-stub.ts test/builtInRenderer.e2e.test.ts
git commit -m "fix: preserve labels in faithful SVG downloads"
~~~

---

## Task 2: Add a committed snapshot and queued portable renderer

**Files:**

- Modify: `test/fixtures/built-in-renderer/types.ts`
- Modify: `test/fixtures/built-in-renderer/mermaid-stub.ts`
- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify: `src/runtime/mermaid-rendering.ts`
- Modify: `src/runtime/built-in-renderer/BuiltInRenderer.vue`

- [ ] **Step 1: Teach the stub to distinguish HTML and native labels**

Add `htmlLabels` to `MermaidRun` and record the current root setting in `initialize`:

~~~ts
let currentHtmlLabels: MermaidConfig['htmlLabels']

initialize: (config: MermaidConfig) => {
  currentHtmlLabels = config.htmlLabels
}
~~~

Retain the existing initialization fields; the snippet above is an addition, not a replacement. Have strict stub renders emit label structure based on the root value:

~~~ts
function createLabelMarkup() {
  if (currentHtmlLabels === false) {
    return '<text id="portable-label"><tspan>foreign content</tspan></text>'
  }

  return `<foreignObject>
    <div xmlns="http://www.w3.org/1999/xhtml">
      <strong>foreign content</strong>
    </div>
  </foreignObject>`
}
~~~

Record `htmlLabels: currentHtmlLabels` in every run and insert `createLabelMarkup()` into every strict SVG output exactly once, replacing the hard-coded Task 1 `foreignObject` in the unsafe branch.

- [ ] **Step 2: Write the failing portable-export integration test**

Add a test that starts from the committed initial diagram, clicks the new control, and does not release the stub render until all preconditions are checked:

~~~ts
const page = await createPage()
await installSvgDownloadCapture(page)
await renderInitialDiagram(page)

const visibleSvg = page.locator('#primary svg[data-run-id="1"]')
const portableButton = page.locator(
  '#primary [aria-label="Download portable SVG"]',
)
const downloadPromise = page.waitForEvent('download')
await portableButton.click()
await waitForRuns(page, 2)

expect(await page.evaluate(() => {
  return (window as MermaidTestWindow).__mermaidControl__?.runs[1]
})).toEqual(expect.objectContaining({
  source: 'graph TD;INITIAL-->DONE',
  htmlLabels: false,
}))
expect(await visibleSvg.count()).toBe(1)

await releaseNext(page)
const download = await downloadPromise
expect(download.suggestedFilename()).toBe('mermaid-diagram-portable.svg')
const downloadPath = await download.path()
expect(downloadPath).not.toBeNull()
const text = await readFile(downloadPath!, 'utf8')
expect(text).toContain('<text')
expect(text).toContain('<tspan>foreign content</tspan>')
expect(text).not.toContain('<foreignObject')
expect(await visibleSvg.count()).toBe(1)
~~~

- [ ] **Step 3: Run the test and confirm the expected failure**

Run:

~~~bash
pnpm vitest run test/builtInRenderer.e2e.test.ts -t "portable SVG"
~~~

Expected: failure because the portable control and detached render seam do not exist.

- [ ] **Step 4: Return the exact successful invocation data**

In `src/runtime/mermaid-rendering.ts`, change only the success member of `MermaidRenderOutcome`:

~~~ts
export type MermaidRenderOutcome
  = | { status: 'skipped' }
    | { status: 'stale' }
    | {
      status: 'success'
      source: string
      config: MermaidConfig
    }
    | { status: 'failure', error: unknown }
~~~

After the atomic visible commit, return the already-materialized invocation-owned `source` and `config`:

~~~ts
dependencies.beforeCommit()
target.replaceChildren(...staging.target.childNodes)

return {
  status: 'success',
  source,
  config,
}
~~~

- [ ] **Step 5: Extract the existing queue boundary and add detached rendering**

Keep a single module-level queue:

~~~ts
function enqueueMermaidOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const outcome = renderQueue.then(operation)
  renderQueue = outcome.then(
    () => undefined,
    () => undefined,
  )
  return outcome
}
~~~

Replace the existing inline `renderQueue.then(render)` block with `enqueueMermaidOperation(render)`. Then add this internal export:

~~~ts
export interface MermaidDetachedRenderOptions {
  loadMermaid: () => Promise<Mermaid>
  source: string
  config: MermaidConfig
  document: Document
}

export function renderDetachedMermaidSvg(
  options: MermaidDetachedRenderOptions,
): Promise<SVGSVGElement> {
  return enqueueMermaidOperation(async () => {
    const mermaid = await options.loadMermaid()
    mermaid.initialize(options.config)
    const staging = createStagingTarget(options.document)

    try {
      const result = await mermaid.render(
        `nuxt-content-mermaid-${++renderId}`,
        options.source,
        staging.target,
      )
      staging.target.innerHTML = result.svg
      const svg = staging.target.querySelector('svg')
      if (!svg)
        throw new Error('Portable Mermaid render did not produce an SVG')
      ensureViewBox(svg)
      return svg.cloneNode(true) as SVGSVGElement
    }
    finally {
      removeStagingRoot(staging.root)
    }
  })
}
~~~

Refactor `createStagingTarget` to accept a `Document` and update the visible renderer call to pass `target.ownerDocument`. The detached path must not call `bindFunctions` or `beforeCommit`.

- [ ] **Step 6: Replace the SVG-only state with one coherent committed snapshot**

In `BuiltInRenderer.vue`:

~~~ts
interface CommittedExportSnapshot {
  source: string
  config: MermaidConfig
  svg: SVGSVGElement
}

const committedExportSnapshot
  = shallowRef<CommittedExportSnapshot | null>(null)

const canDownloadSvg = computed(() => {
  return committedExportSnapshot.value !== null
    && componentSource.value.kind !== 'conflict'
})
~~~

Update only the successful outcome branch:

~~~ts
if (outcome.status === 'success') {
  hasRenderedOnce.value = true
  const committedSvg = getMermaidSvg()
  committedExportSnapshot.value = committedSvg
    ? {
        source: outcome.source,
        config: outcome.config,
        svg: committedSvg.cloneNode(true) as SVGSVGElement,
      }
    : null
}
~~~

Failure, stale, skipped, and conflict paths must leave an existing snapshot untouched. A successful sandbox render has no SVG and therefore clears it.

- [ ] **Step 7: Wire the portable control**

Import `renderDetachedMermaidSvg`, add `isPortableDownloadPending`, and capture the snapshot before waiting on the queue:

~~~ts
const isPortableDownloadPending = ref(false)

async function downloadPortableSvg() {
  const snapshot = committedExportSnapshot.value
  if (!canDownloadSvg.value || !snapshot || isPortableDownloadPending.value)
    return

  isPortableDownloadPending.value = true
  try {
    const portableSvg = await renderDetachedMermaidSvg({
      loadMermaid: $mermaid,
      source: snapshot.source,
      config: {
        ...snapshot.config,
        htmlLabels: false,
      },
      document: snapshot.svg.ownerDocument,
    })
    downloadStandaloneSvg(portableSvg, {
      filename: 'mermaid-diagram-portable.svg',
    })
  }
  catch (error) {
    console.error(
      '[nuxt-content-mermaid] Failed to create portable SVG:',
      error,
    )
  }
  finally {
    isPortableDownloadPending.value = false
  }
}
~~~

Update faithful export to read `snapshot.svg`. Add a second icon button with:

- `title` and `aria-label`: `Download portable SVG`
- `disabled="!canDownloadSvg || isPortableDownloadPending"`
- `@click="downloadPortableSvg"`

The faithful button remains usable while portable rendering is queued.

- [ ] **Step 8: Re-run the focused tests**

Run:

~~~bash
pnpm vitest run test/builtInRenderer.e2e.test.ts -t "downloads|sanitizes|portable SVG"
~~~

Expected: faithful export causes no extra Mermaid run; portable export is run 2 with root `htmlLabels: false`; the downloaded portable stub contains native `text`/`tspan`; the visible SVG remains run 1.

- [ ] **Step 9: Commit the portable seam**

~~~bash
git add src/runtime/mermaid-rendering.ts src/runtime/built-in-renderer/BuiltInRenderer.vue test/fixtures/built-in-renderer/types.ts test/fixtures/built-in-renderer/mermaid-stub.ts test/builtInRenderer.e2e.test.ts
git commit -m "feat: prototype portable SVG downloads"
~~~

---

## Task 3: Lock down snapshot coherence and UI boundaries

**Files:**

- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify only if a regression is exposed: `src/runtime/built-in-renderer/BuiltInRenderer.vue`
- Modify only if a queue regression is exposed: `src/runtime/mermaid-rendering.ts`
- Modify: `test/customRenderer.e2e.test.ts`

- [ ] **Step 1: Prove click-time capture while a newer UI render is pending**

Add a race test:

~~~ts
await renderInitialDiagram(page)
await page.locator('#primary-queue').click()
await waitForRuns(page, 2)

const portableButton = page.locator(
  '#primary [aria-label="Download portable SVG"]',
)
const downloadPromise = page.waitForEvent('download')
const clickPromise = portableButton.click()

await releaseNext(page)
await waitForRuns(page, 3)
expect(await page.evaluate(() => {
  return (window as MermaidTestWindow).__mermaidControl__?.runs[2]
})).toEqual(expect.objectContaining({
  source: 'graph TD;INITIAL-->DONE',
  htmlLabels: false,
}))

await releaseNext(page)
await clickPromise
await downloadPromise
expect(
  await page.locator('#primary .mermaid > svg').getAttribute('data-run-id'),
).toBe('2')
~~~

This must show that the export captured committed run 1 at click time even though queued UI run 2 committed before the export executed.

- [ ] **Step 2: Cover failure, stale completion, and conflict**

Extend the existing `preserves the Committed Diagram through failure and pending recovery` test so both formats still use the old committed source after a failure and while recovery is pending. Extend the stale-generation test so a portable click captured before stale completion still exports the prior successful source.

In the reactive conflict test, assert both controls are disabled:

~~~ts
const faithfulButton = page.locator(
  '#reactive-conflict [aria-label="Download faithful SVG"]',
)
const portableButton = page.locator(
  '#reactive-conflict [aria-label="Download portable SVG"]',
)
expect(await faithfulButton.isDisabled()).toBe(true)
expect(await portableButton.isDisabled()).toBe(true)
~~~

After recovery starts but before it commits, both controls may become enabled, but their captured content must remain the previous committed snapshot.

- [ ] **Step 3: Cover presentation and interaction state**

Update `does not change copy, expand, fullscreen, or zoom state while downloading` to exercise both buttons. For the portable click, release its stub render before awaiting the download. Assert:

- copied state remains visible;
- expand/fullscreen remains active;
- zoom value is unchanged;
- the visible `data-run-id` is unchanged;
- no loading spinner or render error is introduced by export.

- [ ] **Step 4: Preserve renderer boundaries**

Update the sandbox test to assert both built-in download buttons remain disabled before and after the sandbox iframe commits. In `test/customRenderer.e2e.test.ts`, assert the custom renderer exposes neither experimental control:

~~~ts
expect(await page.locator(
  '[aria-label="Download faithful SVG"], [aria-label="Download portable SVG"]',
).count()).toBe(0)
~~~

- [ ] **Step 5: Run the boundary tests**

Run:

~~~bash
pnpm vitest run test/builtInRenderer.e2e.test.ts test/customRenderer.e2e.test.ts
~~~

Expected: all coherence, interaction, sandbox, and custom-renderer assertions pass. If a test fails, make the smallest correction in the two allowed runtime files and rerun this command.

- [ ] **Step 6: Commit coherence coverage**

~~~bash
git add test/builtInRenderer.e2e.test.ts test/customRenderer.e2e.test.ts src/runtime/built-in-renderer/BuiltInRenderer.vue src/runtime/mermaid-rendering.ts
git commit -m "test: cover SVG export snapshot coherence"
~~~

---

## Task 4: Verify real Mermaid output and preserve residual evidence

**Files:**

- Modify: `test/migrationPlayground.e2e.test.ts`
- Modify: `test/fixtures/built-in-renderer/mermaid-stub.ts`
- Modify: `test/builtInRenderer.e2e.test.ts`
- Modify: `src/runtime/built-in-renderer/BuiltInRenderer.vue`
- Verify without changing: `playground/content/mermaid/classdiagram/finance-ledger.md`

- [ ] **Step 1: Add a real-Mermaid comparison test**

Reuse the existing route `/mermaid/classdiagram/finance-ledger` and its explicit visible `class.htmlLabels: true` config. Add a local download helper equivalent to the one in `builtInRenderer.e2e.test.ts`, then download both files from the same rendered block.

Parse each string in the browser with `DOMParser` and return:

~~~ts
return {
  parserErrors: document.querySelectorAll('parsererror').length,
  foreignObjects: document.querySelectorAll('foreignObject').length,
  nativeText: document.querySelectorAll('text, tspan').length,
  textContent: document.documentElement.textContent ?? '',
}
~~~

Assert:

~~~ts
expect(faithful.parserErrors).toBe(0)
expect(faithful.foreignObjects).toBeGreaterThan(0)
expect(faithful.textContent).toContain('User')
expect(faithful.textContent).toContain('Transaction')

expect(portable.parserErrors).toBe(0)
expect(portable.nativeText).toBeGreaterThan(0)
expect(portable.foreignObjects).toBe(0)
expect(portable.textContent).toContain('User')
expect(portable.textContent).toContain('Transaction')
expect(portable.textContent).toContain('Budget')
~~~

Also assert that the visible diagram still contains `foreignObject` after both downloads. This confirms root `htmlLabels: false` takes precedence only in the detached export, including over the fixture's deprecated diagram-specific setting.

- [ ] **Step 2: Run the real-Mermaid test**

Run:

~~~bash
pnpm vitest run test/migrationPlayground.e2e.test.ts
~~~

Expected: the finance-ledger faithful file retains HTML labels; the portable file has native text and no `foreignObject`; both parse as XML; the browser UI remains on HTML labels.

- [ ] **Step 3: Write a failing residual-foreignObject warning test**

Make the stub retain one `foreignObject` during a false-label render only when the source contains the fixture's existing `__UNSAFE__` marker. Trigger it with `#primary-unsafe`, capture browser warnings, and assert:

~~~ts
expect(warnings).toContainEqual(expect.stringContaining(
  'Portable SVG still contains 1 foreignObject element',
))
expect(portableDownloadText).toContain('<foreignObject')
~~~

Expected before implementation: the artifact preserves the element because the shared serializer no longer deletes it, but no warning is emitted.

- [ ] **Step 4: Emit a focused warning without changing the artifact**

Immediately after detached portable render and before download:

~~~ts
const foreignObjectCount
  = portableSvg.querySelectorAll('foreignObject').length
if (foreignObjectCount > 0) {
  console.warn(
    '[nuxt-content-mermaid] Portable SVG still contains '
    + foreignObjectCount
    + ' foreignObject element(s).',
  )
}
~~~

Do not treat this as an error, alter the file, or change visible state.

- [ ] **Step 5: Re-run real and stub coverage**

Run:

~~~bash
pnpm vitest run test/builtInRenderer.e2e.test.ts test/migrationPlayground.e2e.test.ts
~~~

Expected: finance ledger has zero residual `foreignObject` in portable mode; the forced residual fixture warns and preserves its evidence; all earlier download tests remain green.

- [ ] **Step 6: Commit real-output verification**

~~~bash
git add src/runtime/built-in-renderer/BuiltInRenderer.vue test/fixtures/built-in-renderer/mermaid-stub.ts test/builtInRenderer.e2e.test.ts test/migrationPlayground.e2e.test.ts
git commit -m "test: verify dual SVG output with Mermaid"
~~~

---

## Task 5: Full verification, publish the prototype, and hand off comparison steps

**Files:**

- Verify: all files changed in Tasks 1–4
- Do not modify: website content, issue #91 wording, release notes, or public type declarations

- [ ] **Step 1: Run formatting and source verification**

~~~bash
pnpm lint --fix
pnpm test
pnpm test:types
~~~

Expected: all commands exit 0.

- [ ] **Step 2: Run package, playground, and website checks**

~~~bash
pnpm test:package-contract
pnpm dev:build
pnpm --dir website test
~~~

Expected: all commands exit 0; no generated build output is staged.

- [ ] **Step 3: Inspect the final diff and contract boundaries**

~~~bash
git diff --check
git status --short
git diff origin/codex/issue-91-safe-svg-download...HEAD -- src/runtime test playground
git diff origin/codex/issue-91-safe-svg-download...HEAD -- src/types website docs/en docs/zh-TW CHANGELOG.md
~~~

Expected:

- runtime/test diff contains only the dual-prototype implementation and evidence;
- no public type, website, release-note, or production documentation change appears;
- `docs/superpowers` contains only the approved design and this implementation plan;
- there are no unfinished markers, placeholder branches, or conflicting symbol names.

Use these exact internal names consistently:

- `CommittedExportSnapshot`
- `MermaidDetachedRenderOptions`
- `renderDetachedMermaidSvg`
- `SvgDownloadOptions`
- `downloadFaithfulSvg`
- `downloadPortableSvg`

- [ ] **Step 4: Commit any lint-only corrections**

Run `git status --short`. If `pnpm lint --fix` changed tracked source, stage only those task-related paths and commit:

~~~bash
git commit -m "chore: format SVG download prototype"
~~~

Skip this commit when there are no formatting changes.

- [ ] **Step 5: Push the verified branch**

~~~bash
git push origin codex/issue-91-safe-svg-download
~~~

Keep PR #113 in draft and do not rewrite its final product claim until the reviewer chooses a strategy.

- [ ] **Step 6: Hand off manual comparison**

Tell the reviewer to run `pnpm dev`, open `/mermaid/classdiagram/finance-ledger`, and download:

- `mermaid-diagram-faithful.svg` from `Download faithful SVG`;
- `mermaid-diagram-portable.svg` from `Download portable SVG`.

Ask them to compare the same two files in Chrome, Safari, Quick Look/Preview, GitHub preview, Office, and Inkscape when available, checking missing/clipped/reflowed text and layout differences. Also list the implementation files and all verification results. Do not select or delete either candidate until the reviewer reports the comparison.
