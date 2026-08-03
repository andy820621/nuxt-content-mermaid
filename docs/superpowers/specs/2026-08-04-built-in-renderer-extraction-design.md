# Built-in Renderer Extraction Design

## Context

Issue #46 is a pure extraction. The package-owned Built-in Renderer UI and rendering lifecycle currently live inside the public `Mermaid.vue` entry alongside Custom Renderer selection. The extraction must create a deep internal module without changing any observable rendering, fallback, SSR, DOM, CSS-class, slot, timing, interaction, configuration, or diagnostic behavior.

The work depends on the Renderer Selection outcomes introduced by #45. It must preserve the currently observable pending behavior even though ADR 0018 describes a later no-owner neutral pending state. Implementing that later state is explicitly outside this ticket.

## Goals

- Concentrate all Built-in Renderer UI, presentation state, configuration materialization, and rendering lifecycle in one internal deep module.
- Reduce the public Mermaid entry to its established interface, component-source invariant validation, outer styling seam, application component loading required by renderer routing, and Renderer Selection routing.
- Preserve every existing observable behavior and public declaration.

## Non-goals

- No new public prop, slot, runtime option, export, diagnostic, or low-level render adapter.
- No neutral pending markup or ownership behavior from later tickets.
- No change to Renderer Selection outcome semantics, console diagnostics, fallback policy, or Custom Renderer inputs.
- No additional index, facade, middle-man abstraction, or decomposition into multiple new modules.
- No unrelated refactoring.

## Architecture

### Public entry: `src/runtime/components/Mermaid.vue`

The public entry keeps only:

- the existing public `MermaidComponentProps` and default/loading/error slots;
- initial and reactive component-source invariant validation for `pageConfig` and `config`;
- the `.mermaid-outer-wrapper` DOM and outer styling seam;
- application component discovery/loading needed by Custom Renderer routing;
- spinner resolution as a renderer-routing adapter because the Custom Renderer must continue receiving the same `spinner` input;
- #45 Renderer Selection outcomes, request ordering, console output, and Custom/Built-in routing.

The entry passes the already validated `MermaidComponentSource` to the internal renderer. This keeps validation ownership at the public interface while allowing the Built-in Renderer to own source materialization and rendering policy.

Application-component filename matching remains ownership-local on both sides of the boundary: the entry uses it only for Custom Renderer and spinner routing, while the deep module uses it only for the Built-in error component. This small duplication is intentional for #46 because extracting a shared helper would add another module, while injecting a generic loader would widen the internal interface beyond the approved coordination inputs.

### Internal deep module: `src/runtime/built-in-renderer/BuiltInRenderer.vue`

One internal component owns:

- Runtime Mermaid Config snapshots;
- Page/Direct source materialization and mutual-exclusion recovery inputs;
- Theme Resolution Policy;
- toolbar, loading and error presentation, lazy loading, and copy;
- expand, fullscreen, and zoom coordination;
- transactional Render Request creation, invalidation, commit preparation, and stale-result handling;
- Built-in error component resolution;
- all Built-in Renderer CSS.

It receives only internal coordination inputs required to preserve the existing public interface:

```ts
interface BuiltInRendererProps extends MermaidComponentProps {
  componentSource: MermaidComponentSource
  renderingOwnership: 'pending' | 'built-in'
  spinnerComponent: Component | string
}
```

This is an internal component interface and is not exported.

`renderingOwnership` expresses the domain state directly. The internal renderer may mount and render its existing markup in `pending`, but it must not create or execute a Built-in Mermaid Render Request until ownership becomes `built-in`.

## Renderer Selection Data Flow

1. The public entry validates the initial component source. An initial conflict throws exactly as before.
2. With no Custom Renderer Candidate, selection immediately assigns `renderingOwnership = 'built-in'`.
3. With a candidate, the entry mounts `BuiltInRenderer` with `renderingOwnership = 'pending'`. This preserves current SSR and client markup while preventing creation or execution of the Built-in Mermaid Render Request.
4. A `resolved` outcome unmounts `BuiltInRenderer` and mounts the Custom Renderer.
5. A `not-found` or `load-failed` outcome emits the existing console output, changes ownership to `built-in`, and lets `BuiltInRenderer` start its existing setup/fallback path at the existing `nextTick` boundary.
6. Stale asynchronous selection outcomes remain ignored by the current request-id guard.
7. Reactive `pageConfig`/`config` changes remain validated in the entry. The resulting source is passed to the internal renderer, which owns render invalidation, materialization, recovery, and error classification behavior.

## DOM, Slots, and CSS Contract

- `.mermaid-outer-wrapper` remains the sole public-entry root.
- `BuiltInRenderer` renders the existing `.mermaid-block` root directly; no wrapper element is introduced.
- The element hierarchy, class names, CSS hooks, loading/error slot placement, and fallback source markup remain unchanged.
- The Custom Renderer continues to receive only `code`, the default slot, and `spinner`.
- The public entry forwards `loading` and scoped `error` slots to the internal renderer without changing their content or slot props.
- All styles for `.mermaid-block`, toolbar, built-in diagram wrapper, fullscreen, loading, expand, and default error presentation move with the Built-in Renderer. Vue compiler-generated `data-v-*` attributes are not part of the public CSS contract.

## Error and Lifecycle Preservation

- Component-source conflicts retain initial throw, reactive throw, request invalidation, and recovery behavior.
- Built-in Mermaid render failures retain console output, committed-diagram preservation, loading timing, error slot timing, and Built-in error-component behavior.
- Renderer `not-found` and `load-failed` retain their existing console methods and text and do not use the Built-in error component.
- Pending ownership prevents `createMermaidRenderer` from being called and prevents lazy/render setup from executing.
- Unmount invalidates any existing Built-in Render Request and cleans up observers, timers, expand/fullscreen ownership, and other existing lifecycle resources.

## Testing Strategy

The approved seams are:

1. Add a focused source-architecture ownership test. It starts RED because the public entry still owns Built-in imports, lifecycle, template, and CSS. It becomes GREEN only when `Mermaid.vue` routes to the single deep module and Built-in responsibilities live there.
2. Use the existing Nuxt E2E suites as the behavioral contract for public `<Mermaid>` rendering: Built-in and Custom Renderer paths, component configuration, SSR, toolbar, expand, fullscreen, lazy loading, reactive configuration recovery, and transactional rendering.
3. Add a public `<Mermaid>` behavior test only if existing tests do not observe a critical pending-markup or fallback behavior. Do not invent new public behavior for the extraction.
4. Run the focused architecture test during the RED/GREEN cycle, relevant E2E files during extraction, typechecking regularly, and the complete lint, Vitest, typecheck, and package-build gates at the end.

## Spec Self-review

- Placeholder scan: no TBD, TODO, or deferred implementation requirement remains.
- Consistency: the public entry owns validation and routing; the internal renderer owns materialization, presentation, and rendering lifecycle. The interface and data flow match that split.
- Scope: one internal deep module plus one focused architecture test; no unrelated module decomposition.
- Ambiguity: pending mounts existing Built-in markup but cannot create or execute a Render Request; failed selection changes ownership at the existing next-tick fallback boundary.
