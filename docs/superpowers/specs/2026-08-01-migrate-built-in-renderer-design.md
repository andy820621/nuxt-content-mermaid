# Built-in Renderer Migration Design

## Context

Issue #3 introduced the SSR-safe internal `mermaid-rendering` factory while the Built-in Renderer continued using the previous `enqueueRender` seam. Issue #4 completes that migration: the Built-in Renderer must create the factory once, route every existing render trigger through its zero-argument Render Request function, map each Render Outcome to the existing Vue presentation state, and remove the superseded shallow queue.

This work preserves the Compatibility Contract defined by Issue #2 and the repository domain model. The public `$mermaid` adapter, Custom Renderer selection, DOM and CSS hooks, props, slots, lazy rendering, theme and configuration changes, toolbar, expand, fullscreen, and zoom behavior remain externally unchanged.

## Goals

- Make the Built-in Renderer depend on the internal factory as its only rendering execution seam.
- Preserve the current loading, error, and `hasRenderedOnce` presentation semantics.
- Keep the public `$mermaid` loader contract and shared Mermaid instance behavior unchanged.
- Keep Custom Renderer execution completely outside the Built-in Renderer factory path.
- Remove the old shallow queue export, implementation, callers, and queue-only tests.
- Verify the migration at the Built-in Renderer component boundary without observing private queue state.

## Non-goals

- Queue cancellation, deduplication, coalescing, concurrency changes, or pending counters.
- Improvements to the existing boolean loading timing when multiple requests are pending.
- New public APIs, Nuxt injections, auto-imports, hooks, or internal extension points.
- Changes to Custom Renderer props, slots, selection, or rendering behavior.
- Unrelated renderer, toolbar, expand, fullscreen, theme, or configuration fixes.

## Chosen Approach

`Mermaid.vue` directly creates one `createMermaidRenderer` instance during component setup. Stable dependencies are supplied once and use closures to read the latest reactive state at dequeue time. This keeps component presentation ownership local without introducing a composable or plugin-level middle layer.

The rejected alternatives are:

- A new Built-in Renderer composable, which would add an unneeded delegation seam with no second consumer.
- A Nuxt plugin or injection, which would complicate component-scoped Render Target access, SSR lifecycle boundaries, and Custom Renderer bypass behavior.

## Architecture and Data Flow

The Built-in Renderer configures the factory with four stable dependencies:

- `loadMermaid`: the existing public-compatible `$mermaid` loader.
- `readRenderData`: reads the latest Mermaid definition, resolved Mermaid configuration, and Render Target when a queued request begins.
- `prepare`: performs existing attempt-start presentation work by resetting an active expanded view and clearing the prior error state.
- `debug`: the existing resolved debug setting.

Every existing trigger continues deciding *when* rendering is requested, but no trigger participates in Mermaid execution. Initial mount, lazy intersection, theme changes, page configuration changes, and source changes all reach the same zero-argument Render Request function through the Built-in Renderer presentation wrapper.

The presentation wrapper preserves the established ordering:

1. Start loading immediately when proposing the Render Request.
2. Await the factory outcome while the module-scoped FIFO serializes execution.
3. Let `prepare` clear a previous error only when a valid Render Attempt actually starts.
4. Map the outcome to Vue state.
5. End loading when that request resolves.

Multiple pending requests intentionally continue sharing one boolean loading ref. The first resolved request may therefore end loading while another request remains pending; no counter or timing correction is introduced.

## Render Outcome Mapping

| Outcome | `hasRenderedOnce` | Error presentation | Loading |
| --- | --- | --- | --- |
| `success` | Set to `true` | Remains cleared by attempt preparation | End when the request resolves |
| `failure` | Unchanged | Set `hasError` and retain the exact original thrown value in `errorContent` | End when the request resolves |
| `skipped` | Unchanged | Do not create or clear error presentation because no Render Attempt starts | End when the request resolves |

Failure logging keeps its existing diagnostic purpose without requiring exact message text. Execution cleanup and debug queue/attempt/duration diagnostics remain owned and tested by `mermaid-rendering`.

## Custom Renderer Boundary

Module component selection remains unchanged. A Custom Renderer continues replacing the Built-in Renderer component rather than wrapping it, so it neither creates nor calls the Built-in Renderer factory. Its established props, slots, spinner behavior, and DOM output remain intact.

## Shallow Queue Removal

After every Built-in Renderer trigger reaches `createMermaidRenderer`, remove `enqueueRender` from `src/runtime/utils/index.ts` and delete `test/enqueueRender.test.ts`. A repository-wide caller search must confirm that no import or invocation remains. The module-scoped FIFO in `src/runtime/mermaid-rendering.ts` remains private and is not exposed for testing.

## Testing Strategy

The pre-agreed public seam is the Built-in Renderer component behavior. Tests will use a controllable Mermaid stub through the existing Nuxt test utilities and observe rendered DOM and presentation state rather than factory internals.

TDD coverage will verify:

- Loading begins when a Render Request is enqueued.
- A prior error remains visible while a valid request waits and is cleared only when its Render Attempt starts.
- Success, failure, and skipped outcomes map to `hasRenderedOnce`, loading, the error slot, and custom error presentation as specified.
- Multiple pending requests retain the existing boolean loading timing.
- The exact failure object remains available to error presentation.
- A Custom Renderer bypasses the Built-in Renderer factory.

Existing `mermaidRendering.test.ts` coverage remains responsible for shared FIFO serialization, dequeue-time reads, Render Attempt ordering, skipped validation, failure cleanup and identity, queue recovery, SSR safety, and semantic debug events. Existing E2E tests, public loader regression tests, type tests, lint, and the production/module build provide Compatibility Contract regression coverage.

## Expected File Changes

- Modify `src/runtime/components/Mermaid.vue` to configure and invoke the internal factory and map Render Outcomes.
- Modify `src/runtime/utils/index.ts` to remove the shallow queue implementation and export.
- Delete `test/enqueueRender.test.ts`.
- Add or update Built-in Renderer integration tests and their minimal fixture/stub files.
- Strengthen the existing Custom Renderer bypass assertion only if the current observable test does not prove the factory path was untouched.

## Verification

During implementation, run the focused Built-in Renderer integration test and typechecking after each vertical TDD slice. Before completion, run ESLint, the complete Vitest suite, root and playground type tests, and the production/module build required by Issue #4.
