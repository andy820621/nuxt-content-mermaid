# MIA Interaction and Diagnostic Fixture Fixes

Date: 2026-08-11

## Context

PR #84 fixes the missing Markdown page-config SSR failure and the broken `@nuxtjs/mdc@0.23.0` package baseline. Manual MIA verification on the same branch exposed four additional problems that must be fixed in the same PR:

1. Mermaid Journey diagrams align to the top in fullscreen instead of the center.
2. A horizontally scrolled Journey diagram closes from expanded mode toward the off-screen SVG origin before the source container reappears.
3. The playground diagram labelled as a syntax error is valid in Mermaid 11.16.1.
4. The migration conflict-recovery example re-renders successfully, but its static diagram makes recovery visually indistinguishable.

These issues predate the page-config transport changes. The work remains scoped to PR #84 on `codex/fix-missing-page-config-ssr`. It does not change PR #83, release artifacts, RID/MIV records, release workflows, public configuration contracts, or publishing state.

## Mental Model and Invariants

Fullscreen and expanded presentation are temporary views of one successfully rendered source diagram. They may alter presentation state while active, but they must restore the exact source state on exit.

The expanded overlay has two independent geometric objects:

- the **clip frame**, representing the portion of the source diagram that is actually visible through its scroll container; and
- the **diagram plane**, representing the complete cloned SVG and its zoom/pan transform.

Treating those objects as one rectangle caused the current close animation bug. A raw SVG rectangle can extend far outside the source scroll viewport, so it is not a valid close destination.

The following invariants apply:

- The source container's `scrollLeft` and `scrollTop` never change when expanded mode opens or closes.
- The first and last visible animation frames match the source's currently visible pixels, including horizontal clipping.
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

### 2. Make expanded transitions clip-aware (approved option 1)

`MermaidExpandOverlay` will expose separate DOM layers for the clip frame and cloned diagram. `useMermaidExpand` will receive both the SVG target and its authoritative scroll viewport (`.mermaid-wrapper`).

At open time, it will measure:

- the full source SVG rectangle;
- the scroll viewport's inner client rectangle, excluding its border and scrollbar;
- the layout viewport; and
- the intersection of those rectangles, which is the source clip visible on screen.

If the intersection has no area, expanded mode does not open.

The closed-state geometry is:

- clip frame: the visible intersection rectangle;
- cloned diagram: full source width and height, offset inside the clip frame by `sourceSvg.left - visibleClip.left` and `sourceSvg.top - visibleClip.top`.

The open-state geometry is:

- clip frame: the configured expanded viewport after applying the existing margin;
- cloned diagram: centered and scaled to fit that viewport, then controlled by the existing zoom/pan state.

Opening and closing animate both layers together. The clip frame transitions its position and size while hiding overflow; the diagram plane transitions between its scroll-relative source offset and its expanded zoom transform. Therefore a diagram whose source scrollbar is at the far right closes into the visible right-hand slice, not toward the off-screen left edge. When the overlay is removed, the unchanged source scroll container reveals the same slice without a jump.

Resize refresh recalculates both source and expanded geometry without animation. Existing close triggers, body-scroll locking, reduced-motion behavior, ID rewriting, zoom limits, and diagram-replacement cleanup remain intact.

This requires no new public option. The scroll viewport is an internal renderer-to-overlay dependency.

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
- Expanded lifecycle: the new clip and diagram layers still clean up on every close path and diagram replacement.

### Real browser / Nuxt coverage

- Journey fullscreen at the real playground route has centered SVG content and restores its original attribute after exit.
- Journey expanded mode opened from maximum horizontal scroll closes into the source viewport; sampled closing geometry must not travel toward the off-screen raw SVG origin, and source `scrollLeft` remains unchanged.
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
- Fullscreen attribute restoration can corrupt Mermaid output if absence is not distinguished from an empty value. Snapshot presence explicitly.
- A parser error can change across Mermaid versions. Keep the fixture minimal and prove it against the installed version in the regression test.

No public API, configuration schema, dependency baseline, release metadata, or release workflow changes are part of this design.
