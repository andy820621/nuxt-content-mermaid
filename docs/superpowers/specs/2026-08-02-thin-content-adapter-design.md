# Thin Nuxt Content Adapter Design

## Context

Issue #10 narrows the Nuxt Content `content:file:beforeParse` integration after
Issue #8 established the internal Markdown Diagram Transform. The Nuxt
Integration Contract remains unchanged for Package Users, but the hook must not
maintain a second Mermaid-recognition rule before delegating to the transform.

## Adapter Ownership

The Nuxt Content adapter owns exactly three actions:

1. Determine Markdown eligibility from a `.md` file id.
2. Pass the complete eligible `file.body` to `transformMarkdownDiagrams`.
3. Assign the transform's exact return value to `file.body`.

Non-Markdown files are left unchanged and do not invoke the transform. The
adapter does not inspect body content, normalize Markdown, select fallbacks, or
handle transform errors. An unexpected transform failure therefore propagates
through the Nuxt Content build path.

## Semantic Authority

`src/markdown-diagram-transform.ts` is the sole Mermaid recognition semantic
authority. It owns scanner grammar, opaque fence handling, metadata precedence,
Selective Fallback, and Markdown Diagram Protocol output. The adapter has no
candidate regex or other hook-boundary preflight matcher that could reject a
Markdown body the scanner would recognize.

## Testing

The adapter test mocks the internal transform module boundary and observes only
the Nuxt Content contract: `.md` eligibility, complete-body delegation, exact
writeback, and failure propagation. Scanner, metadata, Selective Fallback, and
serialization behavior remain covered by the Markdown Diagram Transform tests.
Existing `enabled: false` coverage remains the module-enable regression check;
the package's rendering paths are unchanged.

## Boundaries

- Issue #9 owns metadata-helper internalization. This ticket does not move or
  refactor metadata helpers.
- Issue #11 owns removal of the package-root `transformMermaidCodeBlocks`
  compatibility export. This ticket leaves that entry intact.
- Renderer, theme, toolbar, diagnostics, performance, and public extension
  points are out of scope.
