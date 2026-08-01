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

**Markdown Diagram Transform**:
The synchronous, deterministic, body-to-body build-time conversion of supported Mermaid fences into component markup. It owns fence recognition, diagram metadata precedence, and the protocol values present in its output.
_Avoid_: Fence conversion pipeline, Markdown transform

**Markdown Diagram Protocol**:
The component markup contract emitted by the Markdown Diagram Transform and consumed by the Built-in Renderer. Compatibility keeps non-target Markdown unchanged and requires target fences to parse through Nuxt Content and MDC into equivalent component, diagram source, per-page configuration, toolbar inputs, and fallback semantics; exact serialization is excluded.
_Avoid_: Transform output, serialized tag

**Page Mermaid Config**:
The independent page/runtime channel carried by a Markdown page's top-level `config` field and delivered to the Built-in Renderer through Nuxt Content and MDC. It is not a per-diagram authoring input.
_Avoid_: Frontmatter config, diagram config

**Mermaid YAML Frontmatter**:
A per-diagram authoring input expressed as fence-local YAML inside Mermaid diagram source and handled by the Markdown Diagram Transform.
_Avoid_: Page frontmatter, Page Mermaid Config

**Mermaid Inline Attributes**:
A per-diagram authoring input expressed on a Mermaid fence's opening info string and handled by the Markdown Diagram Transform together with Mermaid YAML Frontmatter.
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
A queued intent by the Built-in Renderer to render the latest diagram source and resolved Mermaid configuration. It may be skipped before execution when its required source or Render Target no longer exists.
_Avoid_: Render task, queue item

**Render Attempt**:
The execution of a still-valid Render Request. It includes serialized Mermaid execution and ends with either success or failure.
_Avoid_: Render Request

**Render Outcome**:
The success or failure produced by a Render Attempt, independent of how the Built-in Renderer presents loading or error states.
_Avoid_: Exception, UI state

**Render Target**:
The DOM region where a Render Attempt writes diagram source and rendered output. It excludes the Built-in Renderer’s presentation, controls, and styling structure.
_Avoid_: Container, wrapper
