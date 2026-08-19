# SVG and PNG Download Design

**Status:** Approved
**Decision:** Adopt `html-to-image@1.11.11` under the bounded visual-consistency contract.

## Context

The built-in renderer needs one download disclosure with exactly two choices:

- SVG downloads the last successfully committed diagram as a sanitized standalone SVG.
- PNG rasterizes a sanitized clone of that same committed SVG snapshot.

Both formats preserve the user's effective Mermaid configuration, including
their `htmlLabels` choice. Neither format invokes Mermaid again, changes Mermaid
configuration, or derives output from a pending render. Users who need native
SVG text can set `htmlLabels: false`; the visible diagram and downloaded SVG then
follow that setting naturally.

The bounded spike documented in
`docs/research/2026-08-20-client-svg-png-rasterization.md` passed in Chromium,
Firefox, and WebKit after repeated output was judged by the approved perceptual
pixel-diff contract rather than exact pixel hashes.

## Goals

1. Replace the temporary download prototype with one accessible disclosure.
2. Offer exactly two formats: SVG and PNG.
3. Use the same last successfully committed SVG snapshot for both formats.
4. Preserve snapshot coherence through pending, stale, failed, skipped, and
   conflicting renders.
5. Preserve `foreignObject`, Chinese, multiline, bold, webfont, transparency,
   and dimensions in PNG within the approved browser gate.
6. Keep the PNG implementation out of the initial client bundle and load it
   only on the first PNG request.
7. Keep sandbox and custom-renderer ownership unchanged.
8. Provide predictable keyboard and focus behavior with native buttons.

## Non-goals

- Any alternate SVG output or download-time Mermaid rendering.
- Modifying Mermaid configuration during download.
- A format module option or user-selectable raster scale.
- Server-side Puppeteer, HTML-to-SVG conversion, text-to-path conversion, or a
  custom font embedder.
- Retry, delay, browser-specific handling, or fallback PNG output.
- A full ARIA menu or focus trap.
- Cross-origin resource proxying or credentialed resource fetching.
- Exposing `html-to-image`, its types, or its options as package interfaces.

## Dependency and module contract

`html-to-image` is a direct runtime dependency with the exact package version
`1.11.11`:

```json
{
  "dependencies": {
    "html-to-image": "1.11.11"
  }
}
```

It must not use a semver range and must not appear in `peerDependencies`.
Package declarations and root exports must not expose `html-to-image` types,
functions, options, or module paths.

All package-specific rasterization behavior lives behind one internal deep
module, `src/runtime/png-rasterizer.ts`. Its project-owned interface accepts a
sanitized committed SVG snapshot plus positive CSS-pixel dimensions and returns
a PNG `Blob`. The module owns font readiness, stylesheet readability, temporary
DOM, `html-to-image` calls, transparency, size validation, cleanup, and error
normalization. The built-in renderer does not import `html-to-image` directly.

## Public labels

The toolbar label contract contains three download labels:

| Key | Default | Purpose |
| --- | --- | --- |
| `download` | `Download diagram` | Disclosure trigger `title` and `aria-label` |
| `downloadSvg` | `Download as SVG` | Visible SVG choice and accessible name |
| `downloadPng` | `Download as PNG` | Visible PNG choice and accessible name |

The Chinese documentation example uses:

```ts
labels: {
  download: '下載圖片',
  downloadSvg: '下載成 SVG',
  downloadPng: '下載成 PNG',
}
```

No separate option controls format availability.

## Snapshot contract

`CommittedExportSnapshot` owns a detached clone of the last successfully
committed SVG plus its rendered CSS-pixel width and height. It does not retain
Mermaid source or configuration because neither final export path re-renders
Mermaid.

The snapshot changes only after a successful visible SVG commit. A pending,
stale, failed, skipped, sandbox, non-SVG, or conflicting render cannot replace
it. Each export captures the current snapshot before starting asynchronous
work.

Both export paths sanitize a fresh clone through the existing standalone SVG
sanitizer. Sanitization must not mutate either the stored snapshot or the
visible diagram.

## SVG export

SVG export normalizes and serializes the sanitized committed snapshot through
the existing standalone SVG serializer. It preserves the structure Mermaid
produced, including `foreignObject` when the user's configuration uses HTML
labels.

The suggested filename is `mermaid-diagram.svg`.

## PNG rasterization

PNG export passes the sanitized committed snapshot to the internal rasterizer
and performs no Mermaid call:

1. Validate finite, positive CSS-pixel width and height.
2. Await `document.fonts.ready` when the Font Loading API is available.
3. Fail closed if a stylesheet needed by the document cannot expose `cssRules`.
   Same-origin stylesheets and cross-origin stylesheets loaded with anonymous
   CORS are accepted; an opaque or blocked stylesheet aborts PNG export.
4. Mount an inner capture node inside a fixed, off-screen staging host. The
   staging host owns the off-screen position and negative z-index; the capture
   node stays at its local origin, owns the exact committed width and height,
   and contains only the sanitized snapshot.
5. Pass the inner capture node to `getFontEmbedCSS()` and `toBlob()` from
   `html-to-image@1.11.11`.
6. Use the committed width and height for `width`, `height`, `canvasWidth`, and
   `canvasHeight`, with `pixelRatio: 1`, so PNG dimensions equal the committed
   CSS dimensions across engines.
7. Do not provide a background color. Transparent SVG regions remain
   transparent; a background already present in the snapshot renders normally.
8. Require a non-null `image/png` blob and remove every temporary node and URL
   in `finally` paths.

Only one PNG conversion runs per diagram at a time. An inaccessible stylesheet,
font embedding failure, null blob, invalid size, or rasterization error must
produce one package-prefixed error and no download. It must never emit a PNG
that silently substitutes fallback fonts.

## Lazy-loading and pending state

The built-in renderer dynamically imports `src/runtime/png-rasterizer.ts` only
after the PNG choice is activated. A module-scope promise caches that import and
is reused by every later PNG request and every built-in diagram instance. The
promise is not eagerly created, reset, or retried.

The Nuxt module uses the official `build:manifest` hook before dependency hints
are precomputed. It resolves its own PNG rasterizer source file, derives the
exact manifest key relative to the Nuxt root, and sets `prefetch = false` only
when that entry's `src` equals the same module-owned path and the entry remains
dynamic. It does not inspect hashed asset filenames, remove `dynamicImports`,
change any other resource hint, or post-process generated HTML.

The PNG choice enters a visible loading state before awaiting the first dynamic
import. While import or rasterization is pending, it is disabled and exposes
`aria-busy="true"`; the disclosure stays open so the state remains visible.
Success or failure closes the disclosure and restores focus to the download
trigger. Later PNG downloads reuse the already loaded module while still using
the same pending guard during rasterization.

SVG download must not load the PNG module.

## Disclosure and keyboard contract

The trigger and both choices are native `<button>` elements. The trigger uses
`aria-expanded` and `aria-controls`. The choices are ordinary disclosure
content in natural DOM order; the implementation must not use `role="menu"` or
`role="menuitem"` and must not trap focus.

- Enter or Space on the trigger opens the disclosure and focuses SVG.
- Tab moves SVG → PNG → the next toolbar control. Leaving the disclosure closes
  it without moving focus back to the trigger.
- Shift+Tab moves PNG → SVG. Shift+Tab from SVG moves to the download trigger
  and closes the disclosure.
- Escape closes the disclosure and focuses the download trigger.
- Activating SVG completes the download, closes the disclosure, and focuses the
  trigger.
- Activating PNG shows its pending state; completion or explicit failure closes
  the disclosure and focuses the trigger.
- A pointer click outside closes the disclosure without forcing focus.

The disclosure remains closed and the trigger remains disabled until a valid
built-in SVG snapshot exists. Losing export eligibility closes an open
disclosure safely.

## Browser regression contract

The committed representative fixture contains real Mermaid `foreignObject`
labels, Chinese, multiline content, bold content, and a non-system webfont. The
same production rasterizer must run three consecutive times in Chromium,
Firefox, and WebKit for both same-origin and anonymous-CORS webfonts.

Every positive run must verify:

- nonblank `foreignObject`, Chinese, multiline, and bold label pixels;
- the intended webfont rather than fallback-font metrics;
- exact committed width and height on all three PNGs;
- transparent corner alpha when the SVG has no background;
- no Mermaid invocation and no visible-diagram mutation;
- no resource error or warning from the font embedding path.

Repeated-output hashes are diagnostic only. Compare run 1 → 2 and run 2 → 3
pixel-by-pixel. Ignore a pixel when every RGBA channel delta is at most 8. For
each comparison, the ratio of pixels with any channel delta greater than 8 must
be strictly less than `0.0001` (0.01%).

The negative fixture uses an unreadable cross-origin stylesheet. Chromium,
Firefox, and WebKit must all reject it explicitly before producing a PNG, and
the test must prove that no output blob or download was created.

## Production build contract

A production Nuxt fixture build must prove that `html-to-image` is contained
only in an asynchronous client asset associated with the internal PNG
rasterizer:

- no initial HTML, preload, modulepreload, or initial client request includes
  that asset;
- unrelated dynamic assets retain their existing prefetch hints;
- opening the disclosure or choosing SVG does not request it;
- the first PNG activation requests it and shows the pending/disabled state;
- later PNG activations reuse the cached import promise and do not request the
  asset again;
- generated public declarations contain no `html-to-image` reference.

## Documentation cleanup

English and Chinese website documentation must describe the disclosure, its
three labels, snapshot-based SVG/PNG behavior, transparent PNG behavior,
loading/failure behavior, and the keyboard contract. It must state that
`htmlLabels: false` is the user-controlled way to obtain native SVG text.

All obsolete dual-SVG prototype documents, implementation paths, tests,
filenames, and user-facing terminology are removed before PR review.
