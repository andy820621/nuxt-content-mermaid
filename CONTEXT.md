# Nuxt Content Mermaid

This context turns Mermaid diagram source in Nuxt Content into interactive rendered diagrams while preserving the behavior promised to package users.

## Language

**Package User**:
A Nuxt application or developer consuming a released version of nuxt-content-mermaid through documented or typed behavior.
_Avoid_: Caller, consumer

**Compatibility Contract**:
The externally observable Package-Owned Integration Behavior a Package User can rely on, including documented or typed configuration, extension points, lifecycle, and styling hooks. Mermaid's exact SVG, layout, undocumented DOM, and exhaustive diagram behavior are excluded, as are internal implementation, exact performance, and debug log wording.
_Avoid_: Implementation detail

**Package-Owned Integration Behavior**:
The behavior controlled by nuxt-content-mermaid at its Nuxt, Content, configuration, rendering-lifecycle, theme, toolbar, fallback, and extension seams. It includes committing Mermaid's successful output and handling Mermaid failure, but excludes Mermaid input acceptance, exact serialization, geometry, undocumented internals, and exhaustive diagram-feature correctness.
_Avoid_: Mermaid output, exact SVG contract, every diagram type

**Declared-Compatible Combination**:
A dependency combination that falls within a released package line's declared ranges and is therefore presumed to satisfy its Compatibility Contract, whether or not that exact combination is part of fixed compatibility evidence.
_Avoid_: Known-Latest Version, tested combination, best-effort compatibility

**Contract Gap**:
A confirmed failure of a Declared-Compatible Combination to satisfy the Compatibility Contract. It is a defect in a maintained package line rather than a reason to reinterpret or retroactively narrow the declared range.
_Avoid_: Unsupported combination, candidate failure, upstream incompatibility

**Active Support Line**:
A currently maintained package line whose declared host and dependency contract receives dependency updates, ordinary fixes, and new capabilities.
_Avoid_: Latest dependency, Frozen Legacy Release

**Frozen Legacy Release**:
A published package major that remains installable but receives no ordinary fixes, dependency updates, or compatibility expansion. A critical package-caused security backport may be considered individually without making the line maintained again.
_Avoid_: Active Support Line, maintained major, deprecated package

**Migration Assistance Window**:
A bounded period after a breaking package release in which maintainers prioritize migration documentation, usage guidance, and defects in the Active Support Line that prevent migration from a Frozen Legacy Release. It is not a maintenance promise for the frozen line.
_Avoid_: Support window, backport period

**Nuxt Integration Contract**:
The subset of the Compatibility Contract observed when a Package User installs and configures nuxt-content-mermaid as a Nuxt module. It covers accepted Markdown diagram input and generated component markup, but not direct imports of package named exports.
_Avoid_: Package behavior, module API

**Module Activation**:
The build-time decision, controlled by `contentMermaid.enabled` in Nuxt config, that determines whether nuxt-content-mermaid installs its Markdown transformation and runtime integration. It is available within the released package line's Supported Nuxt Range and cannot be overridden through public runtime configuration.
_Avoid_: Runtime enablement, render switch

**Nuxt-Resolved Module Options**:
The single upstream configuration value Nuxt Kit passes into module setup after applying its own option resolution to inline module options and the `contentMermaid` config key. Nuxt owns that pre-setup merge and its `defu` semantics; the package does not claim to recover or reinterpret the original sources.
_Avoid_: Raw module options, config-key options

**Runtime Mermaid Options**:
The serializable pure-data transport contract carried by `runtimeConfig.public.contentMermaid` through Nuxt and Nitro after Module Activation. It is interpreted when a Nuxt application instance is initialized, explicitly excludes `enabled`, and is not a live control plane whose later client-side mutations are observed.
_Avoid_: Module options, runtime module switch, live runtime state

**Runtime Mermaid Snapshot**:
The app-scoped, always deep-frozen result produced from the actual Runtime Mermaid Options payload by applying runtime defaults, shorthand resolution, and validation. Its entire data tree is owned by the package: one snapshot belongs to one Nuxt application or SSR render context and shares no reactive proxy, plain object, or array with either its transport input or package defaults.
_Avoid_: Runtime Mermaid Options, process-global config, reactive config

**Runtime Mermaid Config**:
The open-key, recursively strict-JSON-data subset of Mermaid configuration accepted by `Runtime Mermaid Options.loader.init`. Unknown Mermaid-owned properties survive every transport and resolution step, while properties the package itself reads retain known-type validation; client-only configuration that does not cross a transport seam may use a separately defined complete Mermaid configuration interface.
_Avoid_: Mermaid Config, client Mermaid config

**Mermaid Config Working Copy**:
A mutable Mermaid configuration materialized for exactly one Mermaid initialization or render invocation. Its structural data is isolated from inputs and other invocations while preserving non-cyclic shared-reference relationships within that copy; explicitly allowlisted Opaque Mermaid Capabilities retain provider identity.
_Avoid_: Runtime Mermaid Config, cached Mermaid config

**Opaque Mermaid Capability**:
A non-structural value explicitly required at a versioned Mermaid or DOMPurify configuration path whose behavior cannot be reproduced by structural copying, such as a callback or Trusted Types policy. It remains provider-owned and retains identity without being frozen, wrapped, or traversed.
_Avoid_: Arbitrary class instance, function-only exception

**Property-Presence Merge**:
The fixed-order configuration merge rule that consumes normalized layers from lowest to highest priority, where only an absent property falls back. Two plain-object values merge recursively; every other present value, including arrays, `null`, `false`, zero, and empty strings or arrays, replaces the lower-priority value without mutating inputs or permitting prototype pollution, and layers must not be regrouped because type changes can alter the result.
_Avoid_: defu merge, defaults merge

**Configuration Validation Phase**:
One package-owned contract boundary at which a specific source or resolved result is checked before any dependent configuration work proceeds. Failure stops after collecting that phase's bounded set of safely observable issues, without merging, normalizing, or validating later phases.
_Avoid_: First validation error, whole-pipeline validation

**Configuration Issue**:
One safely observed contract violation within a Configuration Validation Phase, identified by a structured relative path, stable code, expected condition, and received category. It does not repeat the phase or retain the invalid value.
_Avoid_: Exception, validation phase

**Content Mermaid Configuration Error**:
The single phase-scoped failure containing the first failing Configuration Validation Phase, its bounded ordered Configuration Issues, and whether collection was truncated. It never combines issues from different phases and exposes only a Minimal Public Diagnostic Fingerprint outside the package.
_Avoid_: Render error, issue list

**Minimal Public Diagnostic Fingerprint**:
The smallest stable information a Package User may use to recognize a package-originated configuration failure: its error name, top-level code, and a human-readable message containing unambiguous paths for listed issues and an explicit truncation notice when necessary. It is not a public structured-diagnostics API or a guarantee about serialized custom fields.
_Avoid_: Exported error schema, exact error message

**Closed Configuration Object**:
A configuration object whose property names and meanings are owned by nuxt-content-mermaid, so unknown properties are contract violations. A closed object may contain an explicitly delegated Open Configuration Payload as one of its values.
_Avoid_: Strict JSON object, sealed JavaScript object

**Open Configuration Payload**:
A configuration subtree delegated to Mermaid or Markdown whose unknown properties must be preserved unchanged through cloning, merging, snapshots, and working copies. Transport and package-read fields are still validated, and an open payload may contain explicitly package-owned Closed Configuration Objects.
_Avoid_: Unvalidated object, arbitrary JavaScript value

**Markdown Diagram Transform**:
The synchronous, deterministic, body-to-body build-time conversion of supported Mermaid fences into component markup. It owns fence recognition, diagram metadata precedence, and the protocol values present in its output.
_Avoid_: Fence conversion pipeline, Markdown transform

**Markdown Diagram Protocol**:
The component markup contract emitted by the Markdown Diagram Transform and consumed by the Built-in Renderer. Compatibility keeps non-target Markdown unchanged and requires target fences to parse through Nuxt Content and MDC into equivalent component, diagram source, per-page configuration, toolbar inputs, and fallback semantics; exact serialization is excluded.
_Avoid_: Transform output, serialized tag

**Page Mermaid Config**:
The open configuration payload carried by a Markdown page's top-level `config` field and delivered to the Built-in Renderer through Nuxt Content and MDC as `pageConfig`. It is strict pure data under the Content transport contract and is not a per-diagram authoring input.
_Avoid_: Frontmatter config, Diagram Mermaid Config

**Direct Mermaid Config**:
A full Mermaid configuration passed directly by application code through the Built-in Renderer's `config` prop without crossing a runtime, Content, or Markdown transport seam. It may contain path-allowlisted Opaque Mermaid Capabilities and is mutually exclusive with Page Mermaid Config.
_Avoid_: Page Mermaid Config, Runtime Mermaid Config

**Diagram Mermaid Config**:
The effective Mermaid configuration prepared for one diagram render from Runtime Mermaid Config plus exactly one optional source: Page Mermaid Config or Direct Mermaid Config. The two sources are discriminators rather than competing override layers, and Theme Resolution Policy remains separate.
_Avoid_: Page Mermaid Config, Mermaid YAML Frontmatter

**Mermaid Component Configuration Error**:
A component-boundary failure raised when a Built-in Renderer invocation violates its configuration invariants, including mutually exclusive configuration source props. It is maintained across reactive prop updates and remains distinct from transport configuration failures and Mermaid render failures.
_Avoid_: Content Mermaid Configuration Error, Render Outcome

**Component Configuration Conflict**:
A continuous reactive interval in which both `pageConfig` and `config` are provided. It blocks and invalidates Render Generations until the component returns to one legal configuration source.
_Avoid_: Mermaid render failure, invalid diagram

**Theme Resolution Policy**:
The precedence policy that selects a diagram theme from Page Mermaid Config, manual theme mode, detected color mode, and configured fallbacks. It is not a structural configuration merge.
_Avoid_: Theme merge, Mermaid config merge

**Expand Preset**:
The boolean form of `expand` that resets all lower-priority expand state to package defaults, enabled by `true` and disabled by `false`. It is not shorthand for changing only `enabled`.
_Avoid_: Expand flag, enabled shorthand

**Expand Options**:
The object form of `expand`, applied as a Property-Presence patch to lower-priority expand state. Omitting `enabled` preserves the prior activation state, so an object does not re-enable a lower disabled Expand Preset unless it explicitly contains `enabled: true`.
_Avoid_: Expand Preset, raw expand value

**Mermaid YAML Frontmatter**:
A per-diagram, open Markdown payload expressed as fence-local YAML inside Mermaid diagram source. Its Mermaid `config` subtree remains open, while its package-owned `toolbar` subtree is a Closed Configuration Object.
_Avoid_: Page frontmatter, Page Mermaid Config

**Mermaid Inline Attributes**:
A package-owned, closed authoring syntax expressed on a Mermaid fence's opening info string and handled together with Mermaid YAML Frontmatter. Its `config` value enters an Open Configuration Payload, while `toolbar` remains a Closed Configuration Object.
_Avoid_: Page config, Page Mermaid Config

**Selective Fallback**:
The Markdown Diagram Transform rule that recognized invalid diagram input follows its established local fallback, while unexpected transformation failures remain Content build failures.
_Avoid_: Error recovery, fail-safe

**Built-in Renderer**:
The package-provided rendering behavior that becomes the Rendering Owner when no Custom Renderer Candidate exists or after candidate resolution fails.
_Avoid_: Default component

**Custom Renderer Candidate**:
A Package User's configured intent to replace the Built-in Renderer, represented by `components.renderer` until the named component resolves. A candidate is not a Rendering Owner.
_Avoid_: Custom Renderer, selected renderer

**Renderer Selection**:
The per-instance protocol that resolves an optional Custom Renderer Candidate and assigns Rendering Ownership. Candidate resolution completes as either a Custom Renderer or, after reporting a Custom Renderer Resolution Diagnostic, the Built-in Renderer.
_Avoid_: Renderer adapter, renderer branch

**Custom Renderer Resolution Diagnostic**:
An internal, non-public semantic record reported once before Rendering Ownership passes to the Built-in Renderer after candidate resolution fails. It identifies the candidate and whether the failure was `not-found` or `load-failed`.
_Avoid_: Public diagnostic contract, render error

**Rendering Owner**:
The renderer solely responsible for one diagram component instance's rendering experience and lifecycle. An instance may temporarily have no owner while a Custom Renderer Candidate is pending, but it never has more than one.
_Avoid_: Active renderer, renderer path

**Custom Renderer**:
A successfully resolved Package User-provided renderer that completely replaces the Built-in Renderer, owns the entire rendering experience and lifecycle, and receives only its established extension inputs.
_Avoid_: Built-in renderer wrapper

**Render Request**:
A queued intent by the Built-in Renderer to render the diagram state represented by one Render Generation. It may be skipped before execution or made ineligible to commit when that generation is invalidated.
_Avoid_: Render task, queue item

**Render Generation**:
An ordered, component-scoped identity for one legal source and resolved-configuration state. A newer generation, Component Configuration Conflict, or unmount can invalidate it so that queued or executing work cannot commit.
_Avoid_: Render Request, Mermaid diagram ID

**Render Attempt**:
The execution of a still-valid Render Request against a Staging Render Target. It ends with success or failure independently of whether its Render Generation remains eligible to commit.
_Avoid_: Render Request

**Render Outcome**:
The success or failure produced by a Render Attempt, independent of how the Built-in Renderer presents loading or error states.
_Avoid_: Exception, UI state

**Render Target**:
The live DOM region that receives an eligible Committed Diagram. A Render Attempt does not mutate it while Mermaid is still working.
_Avoid_: Container, wrapper

**Staging Render Target**:
A package-owned DOM region isolated from the live Render Target, where Mermaid completes its work before commit eligibility is checked. It may use an offscreen document-connected measurement host when Mermaid requires browser layout, but discarding it cannot alter the currently visible diagram.
_Avoid_: Render Target, hidden live element

**Committed Diagram**:
The latest successful Render Attempt atomically published to the live Render Target. It remains visible while a later attempt fails, becomes stale, or is blocked by a Component Configuration Conflict.
_Avoid_: Render Outcome, cached diagram

**Transactional Render**:
The Built-in Renderer protocol that stages an attempt away from the live DOM and commits it only after success, latest-generation validation, and legal component configuration are all confirmed. It is the invariant that makes preservation of the Committed Diagram a guarantee rather than best effort.
_Avoid_: DOM cleanup, optimistic render

**Release Verification Contract**:
The smallest repeatable body of evidence required to consider a package version safe to publish and healthy after publication. Required automated verification of the Publishable Package Artifact always blocks release; Manual Interaction Verification blocks only when the Release Impact Declaration identifies a relevant risk.
_Avoid_: Test suite, release checklist

**Release Baseline Freeze**:
The release-candidate boundary that fixes published dependency ranges plus the exact Minimum and Known-Latest Compatibility Profiles before artifact verification begins. A later baseline or release-code change invalidates that evidence and requires a rebuilt artifact and fresh verification; unrelated upstream releases wait for a later package release.
_Avoid_: Dependency freeze, support ceiling, release branch

**Minimum Compatibility Profile**:
The fixed-version evidence tuple at the public lower boundaries of the active Nuxt and Nuxt Content ranges, paired with the package's minimum maintained Node runtime and pinned Module-Owned Dependencies. It protects the declared floor without claiming exhaustive coverage of intermediate combinations.
_Avoid_: Oldest lockfile, legacy profile, Known-Latest Compatibility Profile

**Known-Latest Compatibility Profile**:
The atomic fixed-version evidence tuple for Nuxt, Nuxt Content, Mermaid, and Node. One primary dependency dimension changes per ordinary dependency-update pull request, while every dimension is reverified together before any member is recorded as a Known-Latest Version.
_Avoid_: Independent dependency result, actual-latest stack, supported-version list

**Nuxt Toolchain Family**:
The coordinated Nuxt update unit consisting of the public Nuxt host dimension plus the package's `@nuxt/kit` runtime integration dependency and `@nuxt/schema` development baseline. Kit and Schema follow the Known-Latest Nuxt baseline without becoming separate public compatibility dimensions.
_Avoid_: Nuxt peer range, Compatibility Profile dimension, all Nuxt ecosystem packages

**Publishable Package Artifact**:
The exact package archive intended for npm publication, including only the files, exports, types, and runtime code a Package User will receive. Verification against repository source, a source-linked playground, or unpublished build output is not evidence about this artifact.
_Avoid_: Source tree, dist directory, npm release

**Core Runtime Path**:
The representative Package User journey from Nuxt SSR through hydration to Mermaid rendering and fallback behavior. Release verification covers SVG rendering, theme handling, lazy rendering, and error fallback without claiming exhaustive coverage of every option, diagram type, or browser.
_Avoid_: Full feature matrix, unit test coverage

**Registry Smoke Test**:
The intentionally small check run after a version is published as the default npm release. It installs that released version in a clean Package User context and confirms installation, production build, and basic rendering; it detects publication or registry-facing failures but does not replace pre-publication artifact verification.
_Avoid_: Full release suite, local package test

**Supported Nuxt Range**:
The Nuxt versions publicly accepted by one released package line's peer dependency contract. The entire declared range is that line's Compatibility Contract; minimum and latest profile entries are representative evidence rather than the only supported versions, and a new major enters only after explicit compatibility verification.
_Avoid_: Tested Nuxt version, primary Nuxt version

**Supported Dependency Major**:
A major line of Nuxt or another peer dependency that has passed explicit compatibility verification and is included deliberately in the public peer range. Publication of a new upstream major does not make it supported automatically.
_Avoid_: Installable dependency, future-compatible dependency

**Module-Owned Dependency**:
An upstream runtime package, such as Mermaid, that nuxt-content-mermaid installs for Package Users and whose version selection, verification, and upgrade responsibility belongs to this package.
_Avoid_: Peer dependency, host capability, user-installed dependency

**Minor-Bounded Dependency Range**:
The Module-Owned Dependency policy that permits unverified same-minor patches to enter fresh installs under an upstream semver presumption while preventing a new minor or major from flowing without an explicit range update and package release. It is a deliberate maintenance-latency trade-off rather than fixed-version evidence.
_Avoid_: Exact dependency, caret range, Known-Latest Version

**Known-Latest Version**:
The most recent upstream version deliberately pinned after successful compatibility verification for reproducible pull-request evidence. It is distinct from the latest version currently available from the registry.
_Avoid_: Current latest, minimum supported version

**Compatibility Drift Check**:
An optional scheduled canary that smoke-tests the highest non-prerelease versions within published dependency ranges when it remains quiet and inexpensive to maintain. Its failure is only a notification for best-effort investigation and creates no automatic issue, release block, or response obligation.
_Avoid_: Release gate, maintenance commitment, dependency update

**Representative Compatibility Matrix**:
A deliberately small set of minimum, Known-Latest, and high-risk boundary combinations used as evidence for the broader peer-range Compatibility Contract. It does not redefine support as only the combinations that CI happens to execute.
_Avoid_: Exhaustive version matrix, supported-version list

**Unhealthy Release**:
A version already published to npm that cannot reliably install, build, or complete basic rendering because of a confirmed package defect. A first Registry Smoke Test failure begins investigation; only a clean independent retry after infrastructure causes are excluded confirms the state, after which the version is deprecated and a corrective patch is prepared without unpublishing it.
_Avoid_: Failed CI run, flaky test

**Manual Interaction Verification**:
Human evaluation reserved for fullscreen behavior, zoom, pan, drag, clipboard behavior, mobile interaction, and visual readability, with an explicit pass criterion for every check. It runs when the maintainer confirms a relevant Release Impact Declaration or when impact remains uncertain.
_Avoid_: General regression testing, exploratory testing

**Release Impact Declaration**:
A release-time statement of whether the diff can affect package contents, runtime behavior, interaction, styling, browser APIs, or runtime dependencies. An agent recommends the classification from the diff, the maintainer confirms it, and uncertainty activates Manual Interaction Verification.
_Avoid_: Changed-file classifier, informal release judgment
