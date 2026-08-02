# Nuxt Content Mermaid

This context turns Mermaid diagram source in Nuxt Content into interactive rendered diagrams while preserving the behavior promised to package users.

## Language

**Package User**:
A Nuxt application or developer consuming a released version of nuxt-content-mermaid through documented or typed behavior.
_Avoid_: Caller, consumer

**Compatibility Contract**:
The externally observable behavior a Package User can rely on, including documented or typed configuration, rendering behavior, extension points, and styling hooks. Internal implementation, exact performance, and debug log wording are excluded when observable results and ordering remain unchanged.
_Avoid_: Implementation detail

**Nuxt Integration Contract**:
The subset of the Compatibility Contract observed when a Package User installs and configures nuxt-content-mermaid as a Nuxt module. It covers accepted Markdown diagram input and generated component markup, but not direct imports of package named exports.
_Avoid_: Package behavior, module API

**Module Activation**:
The build-time decision, controlled by `contentMermaid.enabled` in Nuxt config, that determines whether nuxt-content-mermaid installs its Markdown transformation and runtime integration. It supports both Nuxt 3 and Nuxt 4 and cannot be overridden through public runtime configuration.
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
The package-provided rendering behavior used when a Package User has not selected a replacement renderer.
_Avoid_: Default component

**Custom Renderer**:
A Package User-provided renderer that completely replaces the Built-in Renderer while preserving its established extension inputs.
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
