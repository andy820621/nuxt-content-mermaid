# Internal Markdown Diagram Transform Design

## Context

Issue #8 is the first preparatory slice of Issue #7. Today the Nuxt module entry owns the Markdown fence scanner and passes fixed Markdown Diagram Protocol values into `transformMermaidCodeBlocks`, while diagram metadata helpers live under runtime utilities. This makes the Package User Markdown path depend on a shallow transform shape that exposes fixed protocol values as parameters even though production has only one valid component identity and Page Mermaid Config binding.

## Scope

Create a module/build-time internal Markdown Diagram Transform whose semantic interface is synchronous `body: string -> body: string`. The internal module owns Mermaid fence recognition, opaque fence boundaries, matching closing fences, empty and unclosed fallback, indentation, newline preservation, multiple-diagram traversal, non-target preservation, the `Mermaid` component identity, and the `config` Page Mermaid Config binding.

The existing Nuxt `content:file:beforeParse` path delegates eligible Markdown to this internal seam. The historical package-root `transformMermaidCodeBlocks` export remains present for this preparatory slice, but it delegates to the same internal seam and cannot vary module-owned protocol values.

## Architecture and Data Flow

`src/markdown-diagram-transform.ts` is the deep module. It scans the complete body exactly once and treats non-Mermaid fences as opaque until a matching close. Recognized Mermaid fences are converted to Markdown Diagram Protocol markup with private protocol constants. Established metadata parsing and Selective Fallback helpers remain behaviorally unchanged in this ticket; Issue #9 will internalize that authoring path.

`src/module.ts` retains Nuxt setup and package-root compatibility only. It imports the deep module, registers the fixed `Mermaid` component, delegates Markdown bodies to the internal transform, and leaves the historical named export present as a compatibility bridge until Issue #11.

## Error Handling

The transform adds no catch-all recovery, warning, diagnostic, callback, or I/O. Established local fallback remains limited to recognized empty, unclosed, or invalid metadata inputs. Unexpected failures propagate to the Nuxt Content build path.

## Testing

Behavior tests import the internal body-to-body seam. They cover representative recognition boundaries, opaque fences, closing-marker matching, empty and unclosed fences, indentation, CRLF preservation, multiple diagrams, metadata fallback, and exact equality for non-target Markdown. Tests do not target private scanner stages or a preflight optimization.

The existing module setup test remains the Nuxt Integration Contract check for Markdown delegation and writeback. Focused Vitest runs and typechecking accompany each TDD slice; final verification includes lint, the complete Vitest suite, type tests, and the module production build.

## Out of Scope

- Moving all metadata helpers out of runtime utilities or adding real MDC protocol parsing tests; Issue #9 owns that work.
- Reducing the Nuxt adapter to only eligibility, delegation, and writeback; Issue #10 owns that contraction.
- Removing the package-root transform export or documenting the 3.0.0 breaking change; Issue #11 owns that work.
- Deliberate fence grammar fixes, renderer changes, diagnostics, performance work, or new public extension points.
