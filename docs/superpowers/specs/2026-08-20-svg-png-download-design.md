# SVG and PNG Download Design

**Status:** Approved

## Context

The built-in renderer currently exposes two temporary SVG candidates. The
final feature needs one download disclosure with SVG and PNG choices.

The two formats must use the same last successfully committed diagram:

- SVG preserves the user's effective Mermaid configuration, including their
  `htmlLabels` choice.
- PNG rasterizes that committed SVG snapshot without invoking Mermaid again or
  changing Mermaid configuration.

Users who need native SVG text can set `htmlLabels: false`; the visible diagram
and downloaded SVG then follow the same setting naturally.

Mermaid CLI provides the behavioral reference for PNG fidelity. It waits for
fonts, measures the rendered SVG with `getBoundingClientRect()`, and captures
the resulting browser rendering with Puppeteer screenshot APIs:

- <https://github.com/mermaid-js/mermaid-cli/blob/master/src/index.js#L482>
- <https://github.com/mermaid-js/mermaid-cli/blob/master/src/index.js#L581-L602>

## Goals

1. Replace the two experimental download buttons with one download trigger.
2. Offer exactly two choices: SVG and PNG.
3. Export the last successfully committed SVG snapshot for both formats.
4. Preserve snapshot coherence through pending, stale, failed, skipped, and
   conflicting renders.
5. Keep sandbox and custom-renderer boundaries unchanged.
6. Provide predictable keyboard and focus behavior with native buttons.

## Non-goals

- Re-rendering with `htmlLabels: false` during download.
- A portable or native-text SVG variant.
- A format module option or user-selectable raster scale.
- Server-side Puppeteer, HTML-to-SVG conversion, text-to-path conversion, or a
  new rasterization dependency.
- A full ARIA menu or focus trap.
- Font embedding or cross-origin resource proxying.

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
committed SVG plus the rendered CSS-pixel width and height captured from the
committed SVG. It does not retain Mermaid source or configuration because
neither final export path re-renders Mermaid.

The snapshot changes only after a successful visible SVG commit. A pending,
stale, failed, skipped, sandbox, non-SVG, or conflicting render cannot replace
it. Export operations capture the current snapshot before starting asynchronous
work.

## SVG export

SVG export clones, sanitizes, normalizes, and serializes the committed snapshot
through the existing standalone SVG serializer. It preserves the SVG structure
Mermaid produced, including `foreignObject` when the user's effective
configuration uses HTML labels.

The suggested filename is `mermaid-diagram.svg`. Export must not mutate the
stored snapshot or visible diagram.

## PNG export

PNG export uses the same snapshot and performs no Mermaid call:

1. Capture the current snapshot when the PNG choice is activated.
2. Await `document.fonts.ready` when the Font Loading API is available.
3. Serialize the sanitized standalone SVG snapshot.
4. Load that serialized SVG through a temporary Blob URL into an `Image`.
5. Draw the image onto a canvas using the captured CSS dimensions and the
   current `devicePixelRatio` for backing-store resolution.
6. Leave the canvas unfilled so absent SVG backgrounds remain transparent; an
   explicit background already present in the SVG renders normally.
7. Encode with `canvas.toBlob(..., 'image/png')` and download
   `mermaid-diagram.png`.
8. Revoke every temporary URL and remove every temporary anchor in success and
   failure paths.

Only one PNG conversion runs per diagram at a time. A failure logs one focused
package-prefixed error, closes the disclosure, and restores focus to the
download trigger. It does not change the visible diagram or committed snapshot.

## Disclosure and keyboard contract

The trigger and both choices are native `<button>` elements. The trigger uses
`aria-expanded` and `aria-controls`. The choices are ordinary disclosure
content in natural DOM order; the implementation must not use `role="menu"` or
`role="menuitem"` and must not trap focus.

- Enter or Space on the trigger opens the disclosure and focuses the SVG
  choice.
- Tab moves SVG → PNG → the next toolbar control. Leaving the disclosure closes
  it without moving focus back to the trigger.
- Shift+Tab moves PNG → SVG. Shift+Tab from SVG moves to the download trigger
  and closes the disclosure.
- Escape closes the disclosure and focuses the download trigger.
- Activating SVG or PNG completes the download, closes the disclosure, and
  focuses the download trigger so another download can be requested.
- A pointer click outside closes the disclosure without forcing focus.

The disclosure remains closed and the trigger remains disabled until a valid
built-in SVG snapshot exists. Losing export eligibility closes an open
disclosure safely.

## Browser compatibility gate

Before treating PNG as production-ready, verify the same representative
snapshot in Chromium, Firefox, and WebKit. The probe and automated coverage
must check:

- visible HTML labels inside `foreignObject`;
- a loaded non-system web font rather than only fallback fonts;
- transparent pixels when the SVG has no explicit background;
- expected dimensions and non-empty diagram pixels;
- no Mermaid invocation and no visible-DOM mutation during PNG export.

If Blob-URL SVG image decoding or canvas drawing cannot preserve
`foreignObject`, fonts, or transparency reliably in any target engine, stop and
report the engine, artifact, observed pixels or error, and minimal reproduction.
Do not add a dependency, server renderer, font embedder, or browser-specific
fallback without a new decision.

## Documentation and prototype cleanup

The final change removes the portable SVG implementation and its tests, removes
the obsolete dual-prototype design and plan, and updates the English and Chinese
website documentation to describe:

- the disclosure and its three labels;
- snapshot-based SVG and PNG behavior;
- `htmlLabels: false` as the user-controlled way to obtain native SVG text;
- PNG as browser rasterization of the committed snapshot.

