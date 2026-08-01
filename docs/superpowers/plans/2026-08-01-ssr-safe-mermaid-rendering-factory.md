# SSR-safe Mermaid Rendering Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Issue #3's internal SSR-safe Mermaid rendering factory and lock its behavior with focused tests, without changing the Built-in Renderer or public package behavior.

**Architecture:** Add a plain TypeScript `mermaid-rendering` module with a module-scoped FIFO. A factory receives stable loader/read/prepare/debug dependencies once and returns a zero-argument Render Request function; each dequeued request reads the latest rendering data and returns an explicit skipped, success, or failure outcome.

**Tech Stack:** TypeScript, Vue `nextTick`, Mermaid types, Vitest 4, pnpm.

## Global Constraints

- Keep the factory internal: no package export, Nuxt injection, auto-import, public type, or extension hook.
- Do not integrate the factory into `Mermaid.vue`; Issue #4 owns Built-in Renderer migration and old queue removal.
- Module evaluation and factory creation must not touch DOM, `performance`, or load Mermaid.
- Preserve the original thrown value by identity and recover the shared FIFO after failures.
- Do not add cancellation, concurrency, coalescing, deduplication, priority, or unrelated fixes.

---

## Task 1: Define the request seam and SSR-safe skip behavior

**Files:**

- Create: `src/runtime/mermaid-rendering.ts`
- Create: `test/mermaidRendering.test.ts`

- [ ] Write focused tests that import/create the factory without browser globals and assert missing source or Render Target returns `skipped` without prepare or Mermaid loading.
- [ ] Run `pnpm exec vitest run test/mermaidRendering.test.ts` and confirm the tests fail because the module is absent.
- [ ] Add the smallest internal dependency and Render Outcome types plus dequeue-time validation needed to pass.
- [ ] Re-run the focused test and typecheck.

## Task 2: Implement valid Render Attempt protocol and global FIFO

**Files:**

- Modify: `src/runtime/mermaid-rendering.ts`
- Modify: `test/mermaidRendering.test.ts`

- [ ] Add behavior tests for latest dequeue-time source/config/target reads across different requesters and prove attempts never overlap.
- [ ] Add an ordering test for validation, prepare, loader, initialize, source write, Vue scheduler, Mermaid run, SVG viewBox normalization, and success outcome.
- [ ] Run the focused test and confirm the new assertions fail for the intended missing behavior.
- [ ] Implement the module-scoped FIFO and the minimal valid-attempt protocol.
- [ ] Re-run the focused test and typecheck.

## Task 3: Implement failure recovery and debug diagnostics

**Files:**

- Modify: `src/runtime/mermaid-rendering.ts`
- Modify: `test/mermaidRendering.test.ts`

- [ ] Add tests for target cleanup, exact thrown-value identity, later-request recovery, and debug enqueue/start/finish/duration/failure semantics without exact message matching.
- [ ] Run the focused test and confirm the new assertions fail.
- [ ] Implement failure outcomes, cleanup, FIFO recovery, and diagnostic events.
- [ ] Re-run the focused test and typecheck.

## Task 4: Verify, review, and commit

**Files:**

- Review all files changed since baseline `0464389`.

- [ ] Run `pnpm lint --fix`, the focused factory test, `pnpm test:types`, and `pnpm test`.
- [ ] Run the module/production build required by the repository release gate.
- [ ] Review the diff on Standards and Spec axes via the repository `code-review` skill; fix and re-run affected checks.
- [ ] Commit the final scoped changes on the current branch using a Conventional Commit message.
