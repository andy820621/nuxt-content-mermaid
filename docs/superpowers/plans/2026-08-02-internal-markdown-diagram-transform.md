# Internal Markdown Diagram Transform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the Package User Markdown path through a synchronous internal body-to-body Markdown Diagram Transform that owns scanner behavior and fixed protocol values.

**Architecture:** Add a build-time deep module containing the scanner and Markdown Diagram Protocol serializer. `src/module.ts` delegates to it while retaining the historical named export as a temporary bridge; established metadata helpers remain unchanged until Issue #9.

**Tech Stack:** TypeScript, Nuxt Kit, Nuxt Content `content:file:beforeParse`, Vitest 4, pnpm.

## Global Constraints

- The semantic seam accepts only a Markdown body string and synchronously returns a body string.
- The scanner is the sole Mermaid fence recognition authority; do not add or test a second grammar.
- The deep module owns component identity `Mermaid` and Page Mermaid Config binding `config`.
- Preserve observable recognition, Selective Fallback, indentation, newline, metadata, and toolbar behavior.
- Keep the package-root transform export present; Issue #11 removes it.
- Do not move metadata helpers or add real MDC protocol parsing coverage; Issue #9 owns that work.
- Do not add catch-all recovery, diagnostics, I/O, state, callbacks, injection, or new public interfaces.

---

### Task 1: Establish the internal body-to-body behavior seam

**Files:**

- Create: `src/markdown-diagram-transform.ts`
- Modify: `test/transformMermaid.test.ts`

**Interfaces:**

- Consumes: raw Markdown `body: string` and the existing deterministic metadata helpers.
- Produces: `transformMarkdownDiagrams(body: string): string`, imported only by source/tests through an internal path.

- [ ] **Step 1: Migrate one behavior test to the internal seam**

Change the test import to `transformMarkdownDiagrams` from `../src/markdown-diagram-transform` and call it with only the Markdown body. Keep a known literal expected result containing `<Mermaid :config="config" ...>`.

- [ ] **Step 2: Run the focused test and verify RED**

Run `python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/transformMermaid.test.ts`.

Expected: FAIL because `src/markdown-diagram-transform.ts` does not exist.

- [ ] **Step 3: Add the minimal deep module**

Move the complete scanner and serializer from `src/module.ts` into `src/markdown-diagram-transform.ts`. Define private constants for `Mermaid` and `config`, export only `transformMarkdownDiagrams(body: string): string`, and preserve existing metadata-helper calls.

- [ ] **Step 4: Run focused tests and typecheck**

Run the focused Vitest helper command, then `pnpm test:types`.

Expected: the migrated behavior test and both typecheck targets pass.

### Task 2: Lock scanner recognition and Selective Fallback behavior

**Files:**

- Modify: `test/transformMermaid.test.ts`
- Modify: `src/markdown-diagram-transform.ts`

**Interfaces:**

- Consumes: `transformMarkdownDiagrams(body: string): string` from Task 1.
- Produces: representative behavioral coverage of the complete body-to-body scanner seam.

- [ ] **Step 1: Add exact non-target and recognition-boundary tests**

Add cases for ordinary Markdown exact equality, language names that merely start with `mermaid`, opaque backtick and tilde fences, and matching close marker character/length.

- [ ] **Step 2: Run focused tests and verify RED where coverage exposes missing deep-module behavior**

Run the focused Vitest helper command. Any new failure must identify an observable behavior gap at the body-to-body seam rather than a private helper call.

- [ ] **Step 3: Preserve the established scanner behavior**

Make only the minimal scanner changes needed to retain the existing grammar while ensuring recognition comes from the full scan. Do not add a preflight regex.

- [ ] **Step 4: Add fallback and formatting cases one vertical slice at a time**

Cover empty and unclosed Mermaid fences, indentation, CRLF, multiple diagrams, and established invalid metadata fallback. After each case, run the focused test before adding the next.

- [ ] **Step 5: Run focused tests and typecheck**

Run the focused Vitest helper command and `pnpm test:types`.

Expected: all transform behavior tests and typechecking pass.

### Task 3: Delegate production paths without changing export presence

**Files:**

- Modify: `src/module.ts`
- Modify: `test/moduleSetup.test.ts`
- Modify: `docs/superpowers/specs/2026-08-02-internal-markdown-diagram-transform-design.md`

**Interfaces:**

- Consumes: `transformMarkdownDiagrams(body: string): string`.
- Produces: the existing Nuxt Markdown path and historical named export both route through the internal seam; package-root export presence is unchanged.

- [ ] **Step 1: Strengthen the Nuxt path regression test**

Keep the existing Markdown transformation assertion and non-Markdown preservation assertion. Add a scanner-recognized case that cannot be rejected by a separate semantic matcher if the adapter still retains one.

- [ ] **Step 2: Run the module setup test and verify its current behavior**

Run `python .agents/skills/vitest/scripts/run_vitest.py --root . -- test/moduleSetup.test.ts`.

- [ ] **Step 3: Delegate to the internal seam**

Import `transformMarkdownDiagrams` in `src/module.ts`, remove the scanner implementation from the module entry, and make both the Content hook and the retained `transformMermaidCodeBlocks` export delegate to it. Keep the named export present while ignoring historical protocol-value arguments so those parameters cannot vary module-owned constants.

- [ ] **Step 4: Update the design document with any implementation-level clarification**

Record only decisions discovered during TDD; do not expand into Issue #9, #10, or #11.

- [ ] **Step 5: Run focused tests and typecheck**

Run both focused test files and `pnpm test:types`.

Expected: transform behavior, module integration, and typechecking pass.

### Task 4: Verify, review, commit, and integrate

**Files:**

- Review all files changed from `main`.

**Interfaces:**

- Consumes: Tasks 1–3 and Issue #8 acceptance criteria.
- Produces: a reviewed Conventional Commit merged locally into `main`.

- [ ] **Step 1: Run final verification on the feature branch**

Run `pnpm lint --fix`, the focused transform test, `pnpm test:types`, `pnpm test`, and `pnpm prepack`. Confirm every command exits zero and inspect the complete result before claiming success.

- [ ] **Step 2: Review Standards and Spec axes**

Use the repository `code-review` skill with fixed point `main`. Run the required Standards and Spec reviews in parallel, fix every actionable finding, and rerun affected checks.

- [ ] **Step 3: Commit the feature branch**

Stage only Issue #8 files and commit with `refactor: establish internal markdown diagram transform`.

- [ ] **Step 4: Merge locally and verify the merged result**

Switch to `main`, merge `codex/issue-8-markdown-diagram-transform` without rewriting unrelated history, rerun the complete test suite, and delete the merged feature branch only after the merged result is green.
