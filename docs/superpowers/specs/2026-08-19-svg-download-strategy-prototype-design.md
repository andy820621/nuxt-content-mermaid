# SVG download strategy prototype

Date: 2026-08-19
Status: Approved

## Context

The built-in renderer should keep `htmlLabels: true` as its default because HTML labels provide the closest match to the browser UI for mixed Markdown/HTML styling, wrapping, alignment, line height, long text, and multilingual content.

That default creates a portability trade-off: Mermaid represents many labels with SVG `<foreignObject>` elements. Browser-based viewers usually render them, while Preview, Office, Inkscape, and conversion tools may omit or lay out the labels differently. Removing `<foreignObject>` from an already-rendered SVG is not a conversion; it deletes the labels.

The prototype will compare two downloadable artifacts from the same last successfully committed diagram before selecting a production contract.

## Goals

- Keep the visible built-in diagram on the existing `htmlLabels: true` default, while continuing to respect an explicit user override.
- Let a reviewer download both a browser-faithful candidate and a portability-oriented candidate from the playground.
- Base both candidates on the last successfully committed diagram, not pending, stale, failed, or conflicting input.
- Produce standalone SVG through `XMLSerializer` without mutating the visible diagram or interaction state.
- Collect enough structural and manual evidence to choose one production strategy.

## Non-goals

- Do not define the final public API or permanent toolbar design.
- Do not update issue #91, production documentation, or release notes before the comparison is complete.
- Do not promise pixel-identical rendering in every SVG viewer.
- Do not build a general HTML-to-SVG text converter, text-to-path pipeline, or raster fallback.
- Do not make a final security contract for arbitrary `securityLevel: 'loose'` HTML during the visual prototype. Prototype downloads are evaluated with trusted playground diagrams; a selected production path must retain or strengthen the existing safety checks.

## Committed export snapshot

After a successful built-in render commits to the visible container, retain an internal snapshot containing:

```ts
interface CommittedExportSnapshot {
  source: string
  config: MermaidConfig
  svg: SVGSVGElement
}
```

The source, effective configuration, and SVG must be detached copies representing the same successful generation. A later pending render, failed render, stale completion, or configuration conflict must not replace the snapshot.

This extends the current downloadable SVG snapshot only as far as required to support the detached portable re-render.

## Candidate A: faithful SVG

The faithful candidate optimizes similarity to the browser UI.

1. Clone the committed SVG.
2. Preserve Mermaid `<foreignObject>` label content.
3. Ensure the root SVG namespace, required XLink namespace, and XHTML namespace inside `<foreignObject>` are explicit.
4. Apply standalone-specific label normalization, including an explicit `overflow: visible` on `<foreignObject>` to avoid depending on HTML-versus-XML selector casing.
5. Retain the existing removal of scripts, embedded browsing/plugin elements, event attributes, interactive anchors, unsafe resource URLs, and unsafe CSS references. The prototype changes the blanket `<foreignObject>` removal only.
6. Serialize with `XMLSerializer` and download as `mermaid-diagram-faithful.svg`.

This candidate cannot make a viewer render `<foreignObject>` when that viewer does not implement it.

## Candidate B: portable SVG

The portable candidate optimizes compatibility with SVG-oriented viewers.

1. Read the committed source and effective configuration snapshot.
2. Create a detached render configuration with root-level `htmlLabels: false`, overriding only that property for the export attempt.
3. Re-render into a detached staging container through the same serialized Mermaid execution boundary used by built-in rendering, so it cannot race with UI rendering or leak global Mermaid configuration.
4. Do not bind click handlers or commit the result to the visible container.
5. Normalize and sanitize the generated SVG, then serialize it with `XMLSerializer`.
6. Download it as `mermaid-diagram-portable.svg`.

The prototype must inspect rather than assume the result: if Mermaid still emits `<foreignObject>` for a diagram type or label feature, record that fact and preserve the evidence instead of silently claiming full portability.

## Prototype UI

The draft branch will temporarily expose two clearly named download controls while running the playground:

- Download faithful SVG
- Download portable SVG

They are experimental controls only. No module option, public type, localization contract, or permanent toolbar layout is added. The unselected path and its control will be removed before the feature is made production-ready.

## Automated verification

Add focused coverage for:

- the committed snapshot keeps source, effective config, and SVG from one successful generation;
- pending, failed, stale, and conflicting generations do not change either download source;
- faithful export does not invoke Mermaid again, preserves expected label text and `<foreignObject>`, and removes active or external content;
- portable export invokes Mermaid with `htmlLabels: false`, produces expected native `<text>`/`<tspan>` labels for the finance-ledger class diagram, and reports any residual `<foreignObject>`;
- both files have standalone namespaces and parse as `image/svg+xml`;
- neither download changes copy, expand, fullscreen, zoom, loading, or visible diagram state;
- the existing sandbox and custom-renderer boundaries remain unchanged.

Run the repository's required lint, Vitest, type, package-contract, website, and relevant browser checks before handing the prototype to the reviewer.

## Manual comparison

Use the same complex class diagram for both downloads and compare:

- Chrome and Safari direct file rendering;
- macOS Quick Look and Preview;
- GitHub SVG preview;
- Office and Inkscape when available;
- Chinese and English labels, bold text, multiline text, long text, and edge labels;
- missing, clipped, rewrapped, shifted, or differently styled text.

The reviewer will choose the production direction using these criteria:

1. similarity to the visible browser diagram;
2. number of target viewers that render all labels;
3. severity of layout differences;
4. security and maintenance complexity;
5. additional render cost and state-management complexity.

## Decision boundary

The prototype answers which artifact should become the default download. It does not commit the project to permanently shipping both formats. If both solve distinct, demonstrated user needs, a separate design decision is required before exposing a production format selector.
