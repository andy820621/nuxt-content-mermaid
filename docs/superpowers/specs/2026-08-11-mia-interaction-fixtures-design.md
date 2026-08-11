# MIA Interaction and Diagnostic Fixture Fixes

Date: 2026-08-11

## Context

PR #84 fixes the missing Markdown page-config SSR failure and the broken `@nuxtjs/mdc@0.23.0` package baseline. Manual MIA verification on the same branch exposed four additional problems that must be fixed in the same PR:

1. Mermaid Journey diagrams align to the top in fullscreen instead of the center.
2. A horizontally scrolled Journey diagram closes from expanded mode toward the off-screen SVG origin before the source container reappears.
3. The playground diagram labelled as a syntax error is valid in Mermaid 11.16.1.
4. The migration conflict-recovery example re-renders successfully, but its static diagram makes recovery visually indistinguishable.

Follow-up browser verification of the first expanded-transition implementation exposed a second-order defect: hiding the document scrollbar changed the source page from a 1265px layout coordinate space to a 1280px overlay coordinate space. A centered Class diagram therefore appeared to move right on open and left on close even though the cloned diagram's own center remained stable. This is part of the expanded-transition bug, not a separate feature.

These issues predate the page-config transport changes. The work remains scoped to PR #84 on `codex/fix-missing-page-config-ssr`. It does not change PR #83, release artifacts, RID/MIV records, release workflows, public configuration contracts, or publishing state.

## Mental Model and Invariants

Fullscreen and expanded presentation are temporary views of one successfully rendered source diagram. They may alter presentation state while active, but they must restore the exact source state on exit.

The expanded overlay has two independent geometric objects:

- the **clip frame**, representing the portion of the source diagram that is actually visible through its scroll container; and
- the **diagram plane**, representing the complete cloned SVG and its zoom/pan transform.

Treating those objects as one rectangle caused the current close animation bug. A raw SVG rectangle can extend far outside the source scroll viewport, so it is not a valid close destination.

Both objects also belong to one **expand session coordinate space**. Source geometry, document layout width, full layout viewport size, and scrollbar gutter must be captured before scroll locking mutates the document. The document layout stays pinned to that snapshot while the overlay is active, while the overlay destination may use the complete layout viewport. Mixing pre-lock source measurements with post-lock document layout is invalid even when the animation endpoints appear individually correct.

The following invariants apply:

- The source container's `scrollLeft` and `scrollTop` never change when expanded mode opens or closes.
- Apart from an explicit viewport resize refresh, the source diagram and scroll viewport keep the same client rectangles from the pre-open snapshot until the overlay is removed.
- The first and last visible animation frames match the source's currently visible pixels, including horizontal clipping.
- Opening follows one monotonic path from the visible source slice to the complete expanded viewport; closing follows the exact reverse path without overshoot or an intermediate reveal of a differently positioned source.
- Removing a document scrollbar may enlarge the expanded viewport, but it must not reflow the underlying source page.
- Fullscreen-only SVG changes are restored exactly, including whether an attribute originally existed.
- A failed render keeps the last successful diagram until one latest valid render commits.
- One continuous configuration-conflict episode emits one captured error; recovery followed by a new conflict starts a new episode.
- Application-level `pageConfig: null` remains invalid, while missing Markdown page config continues to use the internal Content transport normalization already implemented in PR #84.

## Design

### 1. Center Mermaid diagrams in fullscreen

Mermaid 11.16.1 emits `preserveAspectRatio="xMinYMin meet"` for Journey SVGs. The fullscreen stylesheet expands every SVG to the available width and height, so that Journey-specific value anchors the drawing to the top-left. Most other diagram types omit the attribute and therefore use SVG's centered default.

The fullscreen lifecycle will temporarily set the active rendered SVG to `preserveAspectRatio="xMidYMid meet"`:

- On fullscreen entry, locate the current SVG under the render target and snapshot both attribute presence and value.
- Apply the centered value before presenting the fullscreen diagram.
- On fullscreen exit, diagram replacement, or component disposal, restore the exact snapshot. If the attribute was originally absent, remove it instead of writing a synthetic default.
- Keep the fullscreen CSS sizing behavior and zoom/pan model unchanged.

This is a presentation-boundary normalization, not a Mermaid-output rewrite. The normal Content page retains Mermaid's original SVG attribute.

### 2. Keep expanded transitions in one stable coordinate space (revised approved option 1)

`MermaidExpandOverlay` exposes separate DOM layers for the clip frame and cloned diagram. `useMermaidExpand` receives both the SVG target and its authoritative scroll viewport (`.mermaid-wrapper`).

Opening begins by creating one session snapshot before changing document styles. Its initial geometry contains:

- the full source SVG rectangle;
- the scroll viewport's inner client rectangle, excluding its border and scrollbar;
- the intersection of those rectangles with the layout viewport, which is the source clip visible on screen;
- the document's pre-lock `clientWidth`;
- the complete layout viewport used by the fixed overlay; and
- the vertical scrollbar gutter, derived from the difference between the complete viewport and pre-lock layout width.

The full overlay width is `window.innerWidth`, not `visualViewport.width`. On desktop browsers with classic scrollbars, `visualViewport.width` excludes the scrollbar just like `documentElement.clientWidth`; subtracting those values falsely reports a zero gutter and also centers the expanded destination in the narrower source coordinate space. The overlay's `position: fixed` geometry and CSS viewport units belong to the layout viewport, so its width and height are measured with `window.innerWidth` and `window.innerHeight`. Visual viewport resize events remain refresh triggers, but do not redefine the overlay coordinate system.

The captured application styles and platform scrollbar gutter remain immutable for the session. Only an explicit viewport resize may replace the current source and expanded geometry with values derived from that baseline.

The source geometry and document scroll lock are one transaction. Scroll locking stores the application's existing inline `overflow` and `width` styles, pins the document and body to the captured pre-lock layout width, and then hides scrolling synchronously before the next paint. It must not derive the lock width after setting `overflow: hidden`, because the scrollbar has disappeared by then and `clientWidth` describes a different coordinate space.

The session therefore has two intentional destinations:

- **source destination:** the unchanged pre-lock page layout and currently visible source slice; and
- **expanded destination:** the complete layout viewport after applying the configured margin.

For a centered diagram on a page with a 15px scrollbar, moving from a 1265px source layout to a 1280px expanded viewport legitimately moves the diagram center from 632.5px to 640px. That movement must be monotonic. The underlying source remains at 632.5px throughout the session, so it never creates a second apparent motion when the translucent overlay appears or disappears.

If the source intersection has no area, expanded mode does not open.

The closed-state geometry is:

- clip frame: the visible source intersection rectangle; and
- cloned diagram: the complete source SVG, offset inside the clip frame by `sourceSvg.left - visibleClip.left` and `sourceSvg.top - visibleClip.top`.

The open-state geometry is:

- clip frame: the complete layout viewport after applying the configured expanded margin; and
- cloned diagram: centered and scaled to fit that viewport, then controlled by the existing zoom/pan state.

One `isExpanded` state change drives both layers with the same duration and timing function. The clip frame transitions its position and size while hiding overflow; the diagram plane transitions between its source-relative offset and expanded zoom transform. Closing changes the same state in the opposite direction and keeps both the overlay and document lock alive until the target transition completes. Only then may cleanup remove the clone and restore every captured document style.

Consequently, a diagram whose source scrollbar is at the far right closes into the visible right-hand slice rather than the off-screen SVG origin. A centered non-overflowing diagram closes into the still-stationary source renderer rather than a source renderer that moved when the page scrollbar disappeared.

Resize refresh remains non-animated. It updates the locked layout width using the session's measured scrollbar gutter and current viewport, applies that stable layout before remeasuring the source and expanded destinations, and reinitializes the fit transform. It never temporarily clears the width lock to take a measurement. If the resized document no longer requires a vertical scrollbar, refresh drops the reserved gutter before remeasurement so the eventual unlocked page and close destination still agree.

Existing close triggers, body-style restoration, reduced-motion behavior, ID rewriting, zoom limits, source scroll offsets, and diagram-replacement cleanup remain intact. No public option is added. The scroll viewport and session geometry remain internal renderer-to-overlay dependencies.

### 3. Make the debug syntax-error fixture genuinely invalid

The current fixture:

```text
graph TD
    A -->
    B --> C
```

is legal Mermaid syntax and parses as `A --> B --> C`. It will be replaced with the smallest definition proven to reject under the repository's installed Mermaid version.

The regression test will render `/test-debug` through the real Nuxt Content and browser path and assert that:

- the normal diagrams still render;
- the syntax-error example does not contain a successfully rendered diagram SVG;
- the configured error presentation is visible; and
- the diagnostic detail is present and is not reduced to the generic fallback message.

The exact invalid definition will be selected by a RED test/parser check before changing the fixture, so the test does not rely on assumed grammar.

### 4. Make migration conflict recovery observable

The migration example will use a reactive diagram definition and an explicit observable phase:

- Initial valid state renders `DIRECT → ACTIVE` with direct Mermaid config.
- Entering conflict batches a conflicting page config with a `CONFLICT → BLOCKED` candidate definition. The conflict is captured once and the last successful `DIRECT → ACTIVE` SVG remains visible.
- Re-entering without recovery changes no reactive input and does not increment the episode count.
- Recovering batches removal of page config with `RECOVERED → DIRECT`. The direct source becomes valid and one latest render visibly commits the recovered definition.
- Entering conflict after recovery starts a second episode and preserves the recovered SVG.

The existing direct-config title and configuration source remain intact. The fixture demonstrates the transactional render contract instead of implying that recovery failed.

## Test Strategy

Tests are added before production changes and must provide stable RED evidence.

### Targeted unit coverage

- Fullscreen: Journey-style `preserveAspectRatio` is centered only while active and restored on normal exit, replacement, and disposal; an originally absent attribute is removed on restore.
- Expanded metrics: a horizontally scrolled SVG produces a clipped source frame plus the correct negative diagram offset; close state uses those values rather than the raw SVG origin.
- Expanded scroll lock: the pre-lock layout width is captured before overflow changes, the underlying source geometry remains unchanged while locked, resize never measures through an unlocked intermediate state, and all original document styles are restored exactly.
- Expanded lifecycle: the clip and diagram layers still clean up on every close path and diagram replacement.

### Real browser / Nuxt coverage

- Journey fullscreen at the real playground route has centered SVG content and restores its original attribute after exit.
- Journey expanded mode opened from maximum horizontal scroll closes into the source viewport; sampled closing geometry must not travel toward the off-screen raw SVG origin, and source `scrollLeft` remains unchanged.
- A centered non-overflowing diagram on a page with a vertical scrollbar keeps the same source rectangle while locked. Sampled opening centers remain between the source and full-viewport destinations without changing direction, and sampled closing centers traverse the same bounds in reverse before the unchanged source is revealed.
- `/test-debug` exercises the real ContentRenderer route and proves the invalid diagram reaches the detailed error presentation while adjacent diagrams render.
- `/migration` proves one error per continuous conflict episode, visible last-successful preservation, visible recovered output, and a second count only after recovery and re-entry.

Existing PR #84 regression coverage continues to prove missing Markdown page config SSR, configured page behavior, strict application `pageConfig: null`, MDC package artifacts, and public component boundaries.

## Verification

After targeted RED-to-GREEN runs, run:

```text
pnpm lint
pnpm test
pnpm test:types
pnpm test:package-contract
pnpm dev:build
```

Then start the cleaned playground and verify with a JavaScript-enabled real browser:

- the Journey fullscreen and expanded interactions above;
- `/test-debug` detailed failure presentation;
- `/migration` conflict/recovery state transitions;
- `/`, `/test-debug`, and `/migration-page-config` still hydrate without Nuxt/MDC virtual-component errors;
- missing-config and configured Content Mermaid pages remain healthy; and
- the browser console contains no related runtime errors outside the intentionally presented Mermaid syntax error.

## Risks and Containment

- Geometry transitions can regress resize, reduced-motion, zoom, or cleanup. Separate pure measurements from lifecycle code and cover both unit and real-browser paths.
- Browser rectangles can include borders and scrollbar gutters. Use the scroll viewport's client box rather than its outer bounding box, then intersect it with the SVG and layout viewport.
- Scroll locking can silently replace the pre-lock layout viewport with the wider scrollbar-free viewport. Capture layout width and gutter before any overflow mutation, keep that width stable for the complete session, and test the underlying source rectangle rather than only the overlay clone.
- Viewport resize can invalidate both destinations. Refresh the width lock and geometry as one non-animated transaction; never clear the lock for measurement while the session is active.
- Fullscreen attribute restoration can corrupt Mermaid output if absence is not distinguished from an empty value. Snapshot presence explicitly.
- A parser error can change across Mermaid versions. Keep the fixture minimal and prove it against the installed version in the regression test.

No public API, configuration schema, dependency baseline, release metadata, or release workflow changes are part of this design.
