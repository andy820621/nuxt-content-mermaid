---
title: Troubleshooting
description: Recover from the bounded failures most likely to block your first successful Mermaid render.
pageId: troubleshooting
---

This page describes the exact stable artifact `@barzhsieh/nuxt-content-mermaid@3.0.0`. Start with the symptom you can observe, then stop when you reach its escalation threshold. This is a bounded path to First Successful Render, not a general Mermaid debugging encyclopedia.

## Install fails

### Confirm

- `node --version` reports Node.js `>=22.19.0`.
- The application uses Nuxt `^4.1.0` and Nuxt Content `>=3.5.0 <4.0.0`.
- The install command names `@barzhsieh/nuxt-content-mermaid@3.0.0`; Mermaid is not installed separately just to satisfy this module.
- Your Package User-owned Nuxt Content database connector installed successfully. With pnpm 10 and a native connector, confirm that you approved only the build scripts you selected with `pnpm approve-builds`.

These ranges form the package's published dependency boundary. The [artifact-relative Dependency and Migration Contract](https://github.com/andy820621/nuxt-content-mermaid/blob/v3.0.0/docs/en/DEPENDENCY_AND_MIGRATION_CONTRACT.md) explains which dependencies the Package User owns and which dependency the module owns.

### Next step

Align the application with those versions, keep the application's lockfile current, and retry the exact installation from [Getting Started](/getting-started#install). If the database connector failed, resolve that connector installation before diagnosing Nuxt Content Mermaid.

### Escalation threshold

Escalate only after the exact package still fails to install in a fresh minimal Nuxt Content application using a Declared-Compatible Combination. Record the package manager and version, Node version, exact Nuxt and Nuxt Content versions, connector, lockfile state, install command, and complete error. A registry, package-manager, or connector-only failure is not a Contract Gap.

## Build fails

### Confirm

- `@barzhsieh/nuxt-content-mermaid` appears in `modules`.
- Module options use the canonical `contentMermaid` key; the removed `mermaidContent` alias stops Nuxt setup with a configuration error.
- `contentMermaid.enabled` remains build-time Module Activation in Nuxt configuration.
- `runtimeConfig.public.contentMermaid` contains only pure data and does not contain `enabled`.
- The Nuxt Content database connector can start and the production command reaches the module setup phase.

### Next step

Remove one boundary at a time. First run the minimal module registration from [Getting Started](/getting-started#enable-the-module). If the build then succeeds, reapply configuration using the [v2-to-v3 Migration entry](/migration/v3#rename-the-module-key), especially its Module Activation and pure-data runtime transport sections.

Recognize package configuration failures only by their Minimal Public Diagnostic Fingerprint. For module or runtime configuration, the public name is `ContentMermaidConfigurationError` and the code is `CONTENT_MERMAID_CONFIGURATION_ERROR`; private issue objects and exact message wording are not contracts.

### Escalation threshold

Escalate after the same build failure survives in a fresh minimal Nuxt Content application with `@barzhsieh/nuxt-content-mermaid@3.0.0`, a Declared-Compatible Combination, the same smallest pure-data configuration, and no website or playground dependency. Record the complete build command and fingerprint. Until that reproduction violates the Compatibility Contract, treat the failure as an application integration issue rather than a Contract Gap.

## Source stays visible

### Confirm

- The Markdown fence language is exactly `mermaid`.
- The direct content route returns the intended page and JavaScript is enabled.
- The browser console has no hydration, configuration, or Mermaid render error.
- The three-node example from [Getting Started](/getting-started#add-your-first-diagram) behaves the same way.
- A normal production build completes before you test its generated route.

Readable Mermaid source is the intentional no-JavaScript fallback. It is a failure only when JavaScript is available, hydration completes, and the Built-in Renderer still does not replace the source with a rendered diagram.

### Next step

Reload the direct route with the reduced example. If it renders, restore the original diagram incrementally: Mermaid input acceptance and exact diagram correctness belong to Mermaid, not to the package's Package-Owned Integration Behavior. If the reduced example does not render, capture the direct URL, browser error, hydration error, and build result.

### Escalation threshold

Escalate when the reduced example fails after hydration in a fresh minimal Nuxt Content application using the same exact stable artifact and a Declared-Compatible Combination. The reproduction must implicate Package-Owned Integration Behavior—such as Markdown transformation, runtime configuration, rendering lifecycle, or fallback—not merely Mermaid rejecting a diagram.

## Before you open an issue

Use the existing clean Package User reproduction seam; do not use this website as the sole oracle:

1. Begin with a fresh minimal Nuxt Content application.
2. Install the same exact stable artifact and a Declared-Compatible Combination.
3. Reproduce only the smallest observable symptom and preserve its command, configuration, route, source, and public error fingerprint.
4. Classify the result only after comparison with the Compatibility Contract.

A website build, Content, route, shell, hosting, or Contract Demo failure starts as a website failure. If it cannot be reproduced outside the website, it remains a website integration issue. Only a clean Package User reproduction that violates the Compatibility Contract is a Contract Gap. When that threshold is met, [open a GitHub issue](https://github.com/andy820621/nuxt-content-mermaid/issues) with the recorded evidence.
