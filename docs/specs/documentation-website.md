# Documentation Website

## Status

Accepted product, architecture, and verification contract for the initial documentation website. This specification records durable invariants; replaceable tools, repository layout, hosting, visual design, and delivery progress are intentionally excluded.

## Problem Statement

A Prospective Package User currently has to assemble product fit, compatibility, installation, runtime evidence, configuration semantics, migration guidance, and failure recovery from repository-oriented material. That makes the path from evaluation to First Successful Render harder to understand and verify than the package itself requires.

The project needs Canonical Package Documentation that serves the continuous journey from evaluation through installation without turning the playground into a public product surface. It must describe and demonstrate the exact stable package artifact identified by the documentation, remain distinguishable from experimental or unreleased behavior, and avoid creating a second runtime contract that can drift from the package.

## Solution

Provide a static-generated documentation website whose primary purpose is to help a Prospective Package User understand the package, confirm compatibility, install it, and achieve First Successful Render in their own working Nuxt Content application.

The website becomes the Canonical Package Documentation only after the required content and verification capabilities are complete, Website Synchronization is incorporated into the existing release process, and the maintainer explicitly performs authority cutover. Distribution Summaries remain concise entry points rather than independent complete references. The website and playground remain separate application boundaries: the website owns the public adoption journey and Contract Demos, while the playground owns experimentation, regression scenarios, and unreleased behavior.

Production documentation and Contract Demos are artifact-relative. They disclose and use one committed exact stable npm package version, never substitute workspace source for that artifact, and never present unreleased behavior as stable. The website is static-generated and has no request-time runtime dependency; browser-side Mermaid rendering remains part of the demonstrated package behavior, with readable Mermaid source retained as the no-JavaScript fallback.

## User Stories

1. As a Prospective Package User, I want to understand the package purpose and fit quickly, so that I can decide whether to try it.
2. As a Prospective Package User, I want to see the supported Nuxt, Nuxt Content, and Node boundaries before installation, so that I can reject an incompatible path early.
3. As a Prospective Package User, I want an immediate next step from the product introduction, so that evaluation flows directly into installation.
4. As a Prospective Package User, I want to see a Contract Demo backed by the documented stable artifact, so that the product evidence matches what I can install.
5. As a Prospective Package User, I want the shortest complete installation path, so that I can reach First Successful Render without consulting another source.
6. As a Prospective Package User, I want a clear success checkpoint after adding my first Mermaid block, so that I know the integration is working.
7. As a Prospective Package User, I want installation failures routed by symptom, so that I can recover without opening an issue prematurely.
8. As a Package User, I want every public option documented, so that I do not have to infer the public contract from source code.
9. As a Package User, I want each option's type, default, scope, precedence, and minimum example, so that I can predict its effect.
10. As a Package User, I want build-time and runtime configuration boundaries distinguished, so that I do not place an option in an ineffective or prohibited source.
11. As a Package User, I want Supported Constraints distinguished from Recommended Ranges, so that advisory guidance does not masquerade as validation behavior.
12. As a Package User, I want Local Validation identified separately from supported semantics, so that I can distinguish package-owned enforcement from the Supported Constraint without treating either as the definition of the other.
13. As a Package User, I want deprecated no-op options visible in a dedicated deprecated reference, so that their continued acceptance is not mistaken for useful behavior.
14. As a Package User, I want troubleshooting organized around observable symptoms, so that I can recover from the failures most likely to block First Successful Render.
15. As a Package User migrating from version 2, I want one searchable version 3 migration entry, so that I can find the required changes without navigating maintainer history.
16. As a Package User without JavaScript, I want readable and copyable Mermaid source, so that the documentation does not collapse into an empty rendering surface.
17. As a keyboard user, I want the navigation and Contract Demo controls to remain operable, so that the adoption journey does not require a pointer.
18. As a Package User, I want the documentation to disclose the exact package version it describes, so that I can distinguish current evidence from a pending Website Synchronization.
19. As a Package User, I want documentation corrections for existing stable behavior to ship independently of package releases, so that guidance can improve without artificial release coupling.
20. As a maintainer, I want public documentation facts checked against runtime authority, so that Reference changes cannot silently widen or contradict the package contract.
21. As a maintainer, I want website and playground failures classified separately from Contract Gaps, so that infrastructure failures are not misreported as package defects.
22. As a maintainer, I want Website Synchronization tracked as a required release follow-up, so that documentation lag cannot accumulate across stable releases.
23. As a maintainer, I want the website shell and hosting provider to remain replaceable, so that implementation changes do not require reopening the product contract.
24. As a maintainer, I want V1 scope closed by positive Launch Capabilities, so that incidental framework features do not create unplanned guarantees or maintenance processes.
25. As a Package User reading best-effort translated content, I want a clear route to the canonical English documentation, so that I can verify the current stable contract.
26. As a maintainer, I want only canonical English website content to block release, so that best-effort translations do not create an unsupported synchronization promise.

## Implementation Decisions

### Product outcome

- The primary user is a Prospective Package User with an already working Nuxt Content application who is prepared to install the package if its purpose, compatibility, and result are convincing.
- The primary outcome is First Successful Render: the user confirms compatibility, installs the package, and observes a Mermaid diagram render successfully in their own application.
- The adoption experience is designed so that a Prospective Package User can understand product fit, compatibility, representative runtime evidence, and the next step in approximately 30 seconds, then follow a self-contained path intended to reach First Successful Render within five minutes.
- A formal usability study is a maintainer aid, not a release or authority-cutover gate.

### Application boundary

- Canonical Package Documentation and the playground are separate application boundaries.
- The website owns the public evaluation-to-installation journey, Canonical Package Documentation, and Contract Demos.
- The playground owns experiments, debug states, error scenarios, regressions, contributor verification, and unreleased behavior. It does not create a Package User contract.
- The website must not depend on playground routes, global configuration, internal navigation, debug presentation, or test state.
- Preview deployment of the playground does not change its non-contractual status.
- Repository location, application shell, and hosting provider are replaceable implementation details provided this boundary remains intact.

### Authority model

- Package code, public types, defaults, configuration resolution, validation, and tests are the implementation authority for runtime behavior.
- Canonical Package Documentation is the complete human-readable authority for the exact stable package artifact it identifies.
- A Distribution Summary states product fit and compatibility, provides a deliberately bounded Quick Start to First Successful Render, and directs readers to Canonical Package Documentation. It does not independently define the complete public contract.
- Existing Distribution Summaries remain complete enough to serve users until the required content and verification capabilities are complete, Website Synchronization is incorporated into the existing release process, and the maintainer explicitly performs authority cutover.
- Maintainer specifications and release documentation are not automatically part of the public Package User information architecture.

### Language policy

- English is the only canonical and release-blocking website language in V1.
- Existing Traditional Chinese content may remain as a best-effort translation, but it is non-canonical, must not block release, and must direct readers to the Canonical Package Documentation in English.
- Outdated translated content is clearly marked as stale or archived rather than presented as equivalent to current canonical documentation.
- A fully synchronized bilingual website requires a future explicit specification change with defined translation ownership, synchronization, and verification.

### Stable artifact invariant

- Production identifies one committed exact stable npm package version.
- Production Contract Demos install and execute that exact registry artifact; workspace linking, local source fallback, floating tags, source-tag equivalence, and unreleased branch behavior are not acceptable substitutes.
- Documentation may be corrected independently when it truthfully describes behavior already present in the identified artifact.
- Documentation must not claim behavior absent from the identified artifact or change the meaning of supported input, defaults, precedence, scope, error semantics, or compatibility before the corresponding package release exists.
- Previously omitted behavior or Supported Constraints may be documented without a package release when the identified artifact already exhibits the behavior and the evidence either exercises that stable artifact directly or is traceable to release verification for that artifact. A current workspace-source test alone is insufficient evidence about a published artifact. If artifact-relative evidence is absent, the documentation change adds the smallest artifact-level boundary or behavior test needed to establish it.

### V1 Launch Capabilities

The V1 scope is closed by the following positive capabilities:

1. A homepage adoption path that communicates product purpose, fit, compatibility, representative runtime evidence, and the next step.
2. A self-contained Getting Started path with an explicit First Successful Render checkpoint and failure routing.
3. A structured Reference covering every public option.
4. Bounded, symptom-oriented Troubleshooting for the failures most likely to block First Successful Render.
5. A clear and searchable version 2 to version 3 Migration entry.
6. The minimum Contract Demo evidence needed to show basic rendering, theme-aware behavior, one toolbar interaction, and lazy rendering without requiring one route or demo per behavior.
7. Stable-artifact identity, static-generation, fallback, and necessary accessibility verification.
8. Website Synchronization incorporated into the existing stable-release process as a required follow-up.

Capabilities outside this closed set are neither V1 requirements nor V1 guarantees unless an explicit specification change adds them.

### Structured Reference

- Reference entries are structured, human-authored records. Their concrete storage format is not part of this specification.
- Each public option record covers its path, purpose, type, default, configuration scope, precedence, minimum example, relevant lifecycle or error semantics, and deprecation status.
- Machine-derived facts validate the human-readable Reference; automatic extraction does not replace the human explanation of purpose, ownership, lifecycle, precedence, reset behavior, conditional defaults, or downstream semantics.
- Local Validation does not by itself establish, narrow, or widen a Supported Constraint.
- A Supported Constraint may exclude values that Local Validation does not reject only when the exclusion follows an explicitly adopted downstream contract, an algorithmic invariant, or an explicit product contract, and has boundary or behavior evidence.
- A Recommended Range remains advisory and does not narrow the Compatibility Contract.
- Local Validation is reported separately from the Supported Constraint.
- Deprecated accepted no-ops remain discoverable in a deprecated section rather than being silently omitted from parity checks.

### Contract Demo and asset boundary

- A Contract Demo is a live runtime-backed example rendered by the exact stable artifact identified by the documentation. A screenshot, simulated renderer, playground experiment, or unreleased runtime is not equivalent evidence.
- Contract Demos provide only the minimum runtime evidence required by the Launch Capabilities; a complete diagram gallery is not required.
- Stable diagram source and required metadata selected for Contract Demos live at a neutral asset seam that both applications may consume without importing either application's routes, shell, styles, global configuration, or test state.
- Sharing stable source assets does not require a new shared package or shared application UI.
- Contract Demo assets are excluded from the published npm artifact unless a separate explicit package decision includes them.
- The final diagram subjects, visual design, layout, and component composition are implementation-level choices.

### Execution boundary

- Production is static-generated and has no request-time application dependency.
- Document text, metadata, navigation, and Mermaid source fallback are available in the generated artifact.
- Mermaid SVG generation and interactions may occur after browser hydration because they demonstrate the real package runtime.
- When JavaScript is unavailable or fails, readable and copyable Mermaid source remains present rather than an empty rendering region.
- Hosting, deployment identity, and website shell may change without modifying this specification while these properties remain true.

### Replaceable website shell

- The website shell remains replaceable and must satisfy the application, artifact, static-execution, fallback, customization, and verification invariants through public extension seams.
- A bounded spike may evaluate a candidate shell, but spike quantities, detailed exit checks, tool comparisons, and delivery stages belong to implementation planning rather than this durable specification.
- A candidate that requires a fork, direct dependency on private internals, copied private shell components, package patching, or workarounds that bypass public extension seams is incompatible with this specification and is replaced by a thinner shell.

### Documentation and release governance

- Documentation deployment is artifact-relative: a correction may deploy independently whenever it truthfully describes behavior already present in the committed exact stable artifact.
- A documentation change that claims unavailable behavior or changes supported input semantics, defaults, precedence, scope, error semantics, or compatibility waits for a package release that establishes the new contract.
- V1 relies on maintainer judgment for contract-affecting classification; it does not require an automated document classifier.
- Website Synchronization verifies and, when necessary, updates the disclosed package version, Canonical Package Documentation, and affected Contract Demos after a stable package publish.
- A successful npm publish remains valid and is not rolled back when Website Synchronization is pending. The corresponding Website Synchronization item in the existing release checklist remains incomplete until synchronization succeeds.
- While synchronization is pending, the website continues to identify the exact older artifact it describes and must not claim to represent a newer release.
- Website Synchronization is completed before the next stable release so documentation lag does not accumulate.
- Content for a pending stable release may be prepared before publication, but exact registry-artifact verification and production cutover occur only after the package is available.

### Failure classification

- A website build, deployment, integration, route, shell, Content, hosting, or Contract Demo failure is initially classified as a website failure, not a Contract Gap.
- Evidence that implicates package behavior is reproduced in a clean, minimal Nuxt Content consumer using a Declared-Compatible Combination and the same stable artifact.
- Only a clean-consumer reproduction that violates the Compatibility Contract is classified as a Contract Gap.
- Failure that cannot be reproduced outside the website remains a website integration issue.
- This classification reuses the existing issue and test workflow; it does not require a separate triage state machine.

## Testing Decisions

### Test principles and seams

- Tests assert externally observable contracts rather than the chosen website shell, hosting provider, repository location, content file shape, or visual implementation.
- Verification uses the highest applicable seams: the installed stable artifact, the complete generated website artifact, the public structured Reference, browser-observable Contract Demo behavior, and a clean consumer for suspected Contract Gaps.
- Blocking means a failed applicable check prevents production deployment; it does not mean every check runs for every change.
- Existing package configuration, type, browser, package-artifact, and clean-consumer seams are preferred over new lower-level website-specific representations.

### Minimum deployment-blocking verification

Every production deployment verifies:

1. The website builds and prerenders successfully as a static artifact.
2. Every expected public route exists in the generated artifact and resolves to its intended page rather than a fallback or error shell.
3. Internal links, fragments, canonical URLs, and the required sitemap routes close over the generated public surface.
4. Playground and debug routes are absent from the public artifact.
5. The website installs the committed exact stable npm artifact without workspace linking, local source fallback, or a floating package identity.
6. At least one representative Contract Demo hydrates and produces Mermaid SVG using that artifact.
7. Readable and copyable Mermaid source remains present when JavaScript is unavailable.

### Change-scoped blocking verification

- A Reference record or stable-version change verifies option-path coverage, documented types, literal defaults, explicit exceptions, deprecation handling, configuration snippets, and artifact-relative Supported Constraint evidence against public types and configuration resolution. Workspace-source tests alone do not satisfy claims about the identified stable artifact.
- A Contract Demo, website shell, or runtime-integration change verifies the affected theme-aware behavior, toolbar interaction, lazy rendering, and source fallback through browser-observable behavior.
- A package manifest, package-file allowlist, ignore rule, or Contract Demo asset-boundary change verifies that Contract Demo assets do not enter the Publishable Package Artifact unless explicitly intended.
- Checks may be selected from the changed contract surface, but every applicable check remains blocking.

### Accessibility and quality verification

- Automated blocking verification on relevant changes covers critical accessibility violations on the primary public routes, accessible names for custom navigation and Contract Demo controls, keyboard activation, obvious heading-structure errors, readable source fallback, page metadata, canonical URLs, indexable HTML, and sitemap presence.
- Authority cutover and changes to the website shell or interactive controls include a manual check for visible focus, readable light and dark contrast, reduced-motion behavior, and completion of the keyboard-only journey.
- V1 does not claim comprehensive accessibility certification.
- Performance, bundle-size, and broad Lighthouse reports remain observational until a stable, low-noise check demonstrates that it captures a user-relevant regression. Missing indexable HTML or required metadata remains blocking independently of aggregate scores.

### Prior art

- Public configuration behavior continues to use existing type, configuration-resolution, validation, default-snapshot, and documentation-contract tests.
- Browser behavior continues to use the existing Nuxt browser-fixture seam for hydration, SVG rendering, theme, lazy behavior, interaction, and fallback.
- Stable-artifact identity and accidental package contents continue to use the existing package-artifact verification seam.
- Suspected Contract Gaps continue to use clean Package User consumers and Declared-Compatible Combinations rather than the website as the sole oracle.

## Out of Scope

The following are product-level V1 scope exclusions:

- Productizing the playground or treating its experiments and regressions as a public Package User contract.
- A public contributor or regression surface.
- A complete Examples Gallery, recipe library, or arbitrary-code editor.
- A commitment to full-text search completeness, multi-version documentation, or synchronized bilingual documentation.
- Analytics or analytics-event infrastructure.
- Pull-request preview infrastructure.
- Request-time rendering, server APIs, authentication, or personalization.

These exclusions mean V1 does not require, guarantee, or add maintenance processes for the capability. They do not require repository-wide absence enforcement and do not prohibit a replaceable website shell from providing an incidental capability at negligible cost. Every exclusion may be reconsidered through an explicit specification change supported by user need, issue evidence, content scale, or a demonstrated maintenance bottleneck.

## Further Notes

- This specification records invariants rather than the implementation history or rejected alternatives.
- The selected website shell, hosting provider, application directory, deployment domain, structured-record storage format, final visual design, and final Contract Demo subjects are deliberately non-normative.
- Tool selection and repository layout do not require a specification change unless they break an application boundary, artifact invariant, Launch Capability, execution boundary, or verification contract defined here.
- Implementation phases, task checklists, progress, and authority-cutover status belong outside this durable specification.
