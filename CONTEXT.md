# Nuxt Content Mermaid

This context turns Mermaid diagram source in Nuxt Content into interactive rendered diagrams while preserving the behavior promised to package users.

## Language

**Package User**:
A Nuxt application or developer consuming a released version of nuxt-content-mermaid through documented or typed behavior.
_Avoid_: Caller, consumer

**Compatibility Contract**:
The externally observable behavior a Package User can rely on, including documented or typed configuration, rendering behavior, extension points, and styling hooks. Internal implementation, exact performance, and debug log wording are excluded when observable results and ordering remain unchanged.
_Avoid_: Implementation detail

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
