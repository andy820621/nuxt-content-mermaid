# Markdown Page Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry Content-authored Mermaid configuration through the Markdown Diagram Protocol as `pageConfig`, preserving supported Markdown behavior and selective fallback.

**Architecture:** Keep Markdown-owned inputs at the transform boundary. Classify Mermaid YAML frontmatter, fence inline attributes, toolbar metadata, and diagram configuration in named resolvers; validate and normalize each source before applying property-presence merge. The transform emits `:page-config="config"`, which the existing shared component source resolver consumes as Page Mermaid Config.

**Tech Stack:** TypeScript, Nuxt Content/MDC, Mermaid, Vitest, `@nuxt/test-utils`.

## Global Constraints

- Generated Markdown uses `pageConfig`; direct component use retains `config`.
- Unsupported or recognized-invalid fence metadata falls back to the original fence; unexpected transform defects propagate.
- Markdown/Mermaid-owned configuration remains open pure data; package-owned toolbar and inline attribute schemas are closed.
- Apply Property-Presence Merge only after per-source classification and normalization; preserve explicit falsy values, `null`, and array replacement semantics.

---

### Task 1: Establish protocol contract tests (TDD) ✅

**Files:**
- Modify: `test/transformMermaid.test.ts`
- Modify: `test/markdownDiagramProtocol.test.ts`

1. Add assertions that transformed supported fences bind `:page-config="config"` and never `:config="config"`.
2. Add protocol coverage for multiple diagrams, source/config/toolbar semantics, and local fallback for invalid metadata.
3. Run the focused tests and confirm the new assertions fail before implementation.

### Task 2: Introduce named Markdown metadata resolvers ✅

**Files:**
- Create: `src/markdown-diagram-transform/configuration.ts`
- Modify: `src/markdown-diagram-transform/metadata.ts`
- Modify: `test/transformMermaid.test.ts`

1. Define resolver boundaries for Mermaid frontmatter, inline fence attributes, toolbar, and diagram Mermaid config.
2. Normalize accepted inputs, validate ownership-specific schemas, and apply property-presence merge only to normalized values.
3. Preserve unknown Mermaid-owned pure-data keys; reject closed-schema metadata and use a signal that selects the original Markdown fence.
4. Run the transform test file after every red-green loop.

### Task 3: Switch the generated protocol binding ✅

**Files:**
- Modify: `src/markdown-diagram-transform.ts`
- Modify: `test/transformMermaid.test.ts`
- Modify: `test/markdownDiagramProtocol.test.ts`

1. Replace the generated direct `config` binding with the `pageConfig` binding.
2. Route parsed metadata through the named resolvers and make selective fallback atomic: do not generate partial component markup.
3. Preserve non-target Markdown, empty/unsupported fences, indentation, and existing accepted metadata behavior.

### Task 4: Validate Nuxt Content parsing and rendered output ✅

**Files:**
- Modify: `test/markdownDiagramProtocol.test.ts`
- Modify: `test/builtInRenderer.e2e.test.ts` only if the fixture requires additional coverage

1. Verify MDC parses generated markup into the component, diagram source, page configuration, toolbar, and fallback behavior without relying on exact serialization.
2. Verify an emitted page config is consumed by the built-in renderer through the existing Page Mermaid Config source path.
3. Run focused transform/protocol/fixture tests, then lint, full Vitest suite, type checks, and the package build gate.

### Task 5: Review and publish

**Files:** all task-related files above

1. Review the diff against issue #28 and repository standards on independent spec and standards axes.
2. Fix confirmed findings and rerun affected checks.
3. Commit the planned scope, push the feature branch, create a PR linked to `Fixes #28`, and squash merge it into `main` after green checks.
