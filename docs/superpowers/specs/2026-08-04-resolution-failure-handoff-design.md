# Resolution-failure Diagnostic and Fallback Design

## Context

Issue #48 completes the final stage of ADR 0018 after Issue #47 established the no-owner pending phase and single-owner success handoff. `Renderer Selection` already distinguishes `not-found` and `load-failed`, while the public `Mermaid.vue` entry currently emits separate console messages and then assigns Built-in ownership through a second branch.

The change replaces those parallel failure branches with one attempt-scoped protocol. A failed Custom Renderer Candidate resolution may produce a diagnostic and Built-in fallback only when that same selection attempt is still current and actually commits Built-in ownership.

## Goals

- Report one internal Custom Renderer Resolution Diagnostic for each current resolution-failure attempt that commits Built-in ownership.
- Commit the diagnostic and Built-in ownership synchronously, in that order, without yielding between them.
- Preserve the candidate, the `not-found` or `load-failed` reason, and the original `load-failed` context.
- Emit a Package User-readable console diagnostic regardless of `debug`.
- Retain the established Built-in Renderer lifecycle after fallback and the single-Rendering-Owner invariant.
- Make this protocol the only resolution-failure route into Built-in fallback.

## Non-goals

- No public structured-diagnostics API, exported runtime type, option, error class, prop, slot, or fail-closed mode.
- No stable guarantee for diagnostic object layout, console method, exact wording, punctuation, internal function names, or test-helper shape.
- No change to Custom Renderer inputs or to the rule that setup, mount, and render failures remain under Custom Renderer ownership.
- No use of `components.error` for Custom Renderer resolution or execution failures.
- No change to Built-in Theme Resolution Policy, toolbar, loading, error presentation, lazy loading, expand, fullscreen, zoom, or transactional rendering.
- No dynamic import solely to manufacture a new ordering boundary; existing ADR instrumentation defines Built-in module/factory creation for this work.

## Considered Approaches

### Attempt-scoped one-shot handoff coordinator — selected

Each pending Renderer Selection attempt owns a one-shot failure commit. After its asynchronous outcome settles, the public entry first applies the existing current-attempt check. A current failure then invokes the commit exactly once. The commit synchronously reports the internal diagnostic and commits Built-in ownership.

This keeps stale cancellation outside the protocol, centralizes ordering and deduplication, and leaves the asynchronous component loader separate from the synchronous ownership commit.

### Report while resolving the candidate — rejected

Reporting inside the resolution promise is smaller, but a superseded attempt could report after it becomes stale even though it never commits Built-in ownership. That breaks the approved attempt identity.

### Keep independent warning and fallback branches in `Mermaid.vue` — rejected

This preserves the current shape but makes diagnostic ordering, exactly-once behavior, and fallback entry dependent on Vue watcher control flow rather than a single Renderer Selection invariant. It also leaves the parallel paths that Issue #48 explicitly replaces.

## Attempt Identity and State

One attempt begins when a normalized, non-empty Custom Renderer Candidate starts resolution. It remains eligible until a newer Renderer Selection request supersedes it. A deliberate later retry is a distinct attempt, even if the candidate string is unchanged.

The one-shot commit records whether it has been consumed. Its observable rules are:

1. A stale or cancelled outcome is ignored before the commit is invoked; it emits no diagnostic and assigns no Rendering Owner.
2. A current `resolved` outcome assigns Custom Renderer ownership and never enters the failure protocol.
3. A current `not-found` or `load-failed` outcome invokes its attempt's failure commit.
4. The first invocation reports the diagnostic and then commits Built-in ownership synchronously.
5. Later invocations for the same attempt are no-ops.
6. A later intentional retry gets a new one-shot commit and may independently report and fall back.

The existing request identity may remain an implementation detail. The design does not require a particular counter, token, closure, class, or object representation.

## Synchronous Failure Commit

The failure commit is a non-async operation with no `await`, promise chaining, `nextTick`, or other yield between its two effects:

1. Report an internal semantic diagnostic.
2. Commit `rendererSelectionState` to Built-in ownership.

The state commit is the only resolution-failure entry into Built-in fallback. Vue may schedule Built-in mounting after the synchronous state assignment, but the semantic diagnostic has already completed before that assignment and therefore before the established Built-in factory and Mermaid execution instrumentation can occur.

The commit consumes the attempt before invoking externally injected effects. This prevents re-entrant or repeated observation from reporting or assigning twice. Reporter failure is not converted into a second fallback path.

## Diagnostic Semantics

The injected internal reporter receives enough semantic information to prove:

- the event is a resolution failure;
- the normalized Custom Renderer Candidate;
- the reason is `not-found` or `load-failed`;
- the original failure value for `load-failed`.

The diagnostic representation remains internal to runtime orchestration and deterministic tests. It is not re-exported from the package entry or added to public declarations.

The production reporter emits one human-readable console diagnostic containing the existing package prefix, the candidate, and a reason understandable without enabling debug mode. A `load-failed` diagnostic also passes through understandable original failure context. The reporter is called unconditionally; `Runtime Mermaid Options.debug` does not gate it.

## Renderer Selection Integration

`src/runtime/rendererSelection.ts` owns the attempt-scoped failure handoff seam because it is the deep module responsible for Renderer Selection outcomes and ownership protocol. The seam accepts injected reporting and ownership-commit effects so tests can observe semantics and ordering without asserting private Vue refs.

`src/runtime/components/Mermaid.vue` remains responsible for the existing current-request check and for committing its rendering state. Its failure path delegates to the one-shot handoff. The old component lookup warning branches and independent `status !== 'resolved'` fallback assignment are removed.

The established paths remain unchanged:

- `no-candidate` directly selects the Built-in Renderer without a resolution-failure diagnostic;
- `pending` has no Rendering Owner;
- `resolved` selects only the Custom Renderer;
- Custom Renderer setup, mount, or render failure does not select Built-in fallback;
- Built-in Mermaid Render Outcome failure alone may use `components.error`.

## Testing Strategy

### Internal Renderer Selection seam

Focused Vitest tests use injected effects and semantic matching rather than a fixed object snapshot. They prove:

- `not-found` reports `resolution-failed`, candidate, and the corresponding reason;
- `load-failed` reports the same semantic identity and preserves the original failure value;
- a stale or cancelled attempt never invokes the failure commit, diagnostic reporter, or ownership effect;
- repeated invocation of one attempt commits diagnostic and ownership exactly once;
- the event order is diagnostic before Built-in ownership;
- a distinct retry attempt can independently commit once.

### Public Mermaid integration and E2E seam

Public tests observe Package User-visible behavior and accepted instrumentation:

- `debug: false` and `debug: true` both emit understandable output containing the package prefix, candidate, and reason;
- `not-found` and `load-failed` both enter the same Built-in fallback lifecycle;
- Built-in factory creation and Mermaid execution occur only after the diagnostic and only once;
- repeated Vue updates or render cycles do not create a second Built-in owner or duplicate the diagnostic;
- Custom Renderer resolution failure does not render `components.error`;
- existing successful Custom Renderer setup/mount/render failure coverage continues to prove that execution failures never enter this protocol.

Tests may capture semantic console arguments and established diagnostic events, but do not pin an exact string, console method, punctuation, event property layout, internal symbol name, or pending DOM hierarchy.

## Verification

During TDD, run the focused Renderer Selection test after each RED and GREEN step, then the affected Custom Renderer fallback and ownership integration tests. Run typechecking regularly. Before review and publication, run ESLint, the complete Vitest suite, root and playground type checks, package-contract checks, the package build, and relevant browser fixtures.

## Spec Self-review

- Placeholder scan: no TBD, TODO, deferred decision, or unspecified error-handling requirement remains.
- Consistency: attempt currency is checked before the one-shot commit; the commit reports before assigning Built-in ownership and is the sole failure fallback entry.
- Scope: the design changes only resolution-failure diagnostics and handoff orchestration; successful selection and renderer execution semantics remain unchanged.
- Ambiguity: a retry is a new attempt, stale outcomes are no-ops, consumption precedes injected effects, and no asynchronous boundary exists inside the failure commit.
