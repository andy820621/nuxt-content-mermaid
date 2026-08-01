# Internalize Diagram Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the internal Markdown Diagram Transform own per-diagram metadata and verify the emitted Markdown Diagram Protocol through real MDC parsing.

**Architecture:** Keep `src/markdown-diagram-transform.ts` as the stable body-to-body entry. Move metadata parsing and merging into an internal sibling, keep protocol serialization private to the deep module, and remove transformation exports from app-runtime utilities.

**Tech Stack:** TypeScript, Nuxt Content 3, `@nuxtjs/mdc` parser, YAML, defu, destr, Vitest 4, pnpm.

## Global Constraints

- Preserve metadata parsing, precedence, toolbar semantics, unsafe-key filtering, and Selective Fallback without deliberate behavior change.
- Keep Page Mermaid Config independent and emit only the existing `config` binding.
- Do not modify `src/module.ts`, remove the package-root transform export, or change renderer behavior.
- Do not snapshot complete markup or constrain serializer spelling.
- Unexpected failures must propagate.

---

### Task 1: Characterize the complete per-diagram authoring path

**Files:**

- Modify: `test/transformMermaid.test.ts`
- Test: `test/transformMermaid.test.ts`

**Interfaces:**

- Consumes: `transformMarkdownDiagrams(body: string): string`.
- Produces: body-to-body behavior coverage for precedence, toolbar projection, unsafe paths, local fallback, and unexpected failures.

- [ ] Add one representative seam test that combines YAML toolbar values, inline overrides, nested config merge, and unsafe inline paths.
- [ ] Run the focused test against a temporary protocol mutation and confirm it fails, then restore the protocol value before production edits.
- [ ] Run `pnpm exec vitest run test/transformMermaid.test.ts` and `pnpm test:types` after restoration.

### Task 2: Relocate metadata into the deep module

**Files:**

- Create: `src/markdown-diagram-transform/metadata.ts`
- Modify: `src/markdown-diagram-transform.ts`
- Delete: `src/runtime/utils/mermaid-transform.ts`
- Modify: `src/runtime/utils/index.ts`
- Test: `test/transformMermaid.test.ts`

**Interfaces:**

- Consumes: raw fence info, raw Mermaid source, newline spelling, and fence indentation.
- Produces: private metadata parsing/merging results used only by `transformMarkdownDiagrams`.

- [ ] Move the existing deterministic metadata implementation without changing parser or merge semantics.
- [ ] Move transform-only attribute serialization out of the runtime utilities barrel.
- [ ] Import the internal sibling only from the stable deep-module entry and remove the runtime barrel export.
- [ ] Run the focused transform test and `pnpm test:types`.

### Task 3: Verify the Markdown Diagram Protocol through real MDC parsing

**Files:**

- Create: `test/markdownDiagramProtocol.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: transformed Markdown and `parseMarkdown` from `@nuxtjs/mdc/runtime`.
- Produces: normalized semantic assertions over parser nodes and props.

- [ ] Add `@nuxtjs/mdc` as an explicit test dependency at the version used by Nuxt Content.
- [ ] Parse a representative page containing Page Mermaid Config plus YAML and inline per-diagram metadata.
- [ ] Assert component identity, decoded diagram source/frontmatter semantics, independent page config data, config binding, and toolbar props.
- [ ] Parse invalid Mermaid YAML Frontmatter and assert the representative local fallback without matching complete markup.
- [ ] Run the protocol test, combined focused tests, and `pnpm test:types`.

### Task 4: Verify, review, and deliver

**Files:**

- Review all changes from `origin/main`.

**Interfaces:**

- Consumes: Issue #9 acceptance criteria and the complete feature diff.
- Produces: a reviewed commit and PR from `codex/issue-9-internalize-diagram-metadata`.

- [ ] Run `pnpm lint --fix`, focused transform/protocol tests, `pnpm test:types`, `pnpm test`, and `pnpm prepack`.
- [ ] If the documented local Vitest collection or Nuxt parallel-start failure occurs, run `pnpm exec vitest run --exclude '.agents/**' --no-file-parallelism` and record both outcomes.
- [ ] Run the repository `code-review` skill with `origin/main` as fixed point, fix findings, and rerun affected verification.
- [ ] Commit with a Conventional Commit, push the exact branch, create a `main` PR with `Closes #9`, wait for CI, and use exact-head confirmation before landing.

