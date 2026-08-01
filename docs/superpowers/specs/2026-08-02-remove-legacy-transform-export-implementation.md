# Remove Legacy Transform Export Implementation Notes

## Scope

Issue #11 completes the Candidate 02 package-contract contraction designed in
Issue #7. The package root no longer exposes `transformMermaidCodeBlocks` at
runtime or through generated TypeScript declarations. No alias, deprecated
wrapper, or replacement API is provided.

`src/markdown-diagram-transform.ts` remains a module/build-time internal seam.
It is not exported from the package root, the runtime utilities barrel, or the
app runtime.

## Preserved package contract

The package root continues to provide the Nuxt module default export and the
intentionally supported `ModuleOptions` type. Loading the package declarations
also preserves the existing `NuxtConfig.contentMermaid` augmentation.

The Nuxt Content adapter remains unchanged: it checks `.md` eligibility,
passes the complete body to `transformMarkdownDiagrams(body)`, and writes the
exact result back to `file.body`. The Markdown Diagram Protocol, Page Mermaid
Config runtime channel, Built-in Renderer, Custom Renderer, SSR, and Package
User rendering paths are unchanged.

## Built-artifact verification

`pnpm prepack` produces the package artifacts under the ignored `dist`
directory. `test/packageContract.test.ts` imports the package self-reference,
which resolves through `package.json` to the built runtime, and verifies the
module namespace has a default export but no `transformMermaidCodeBlocks` key.
The test does not inspect source text or snapshot bundle formatting.

`test/package-contract/package-user.ts` and `removed-transform.ts` are compiled
through their focused Package User `tsconfig.json`. The positive fixture
verifies the default export, `ModuleOptions`, and the Nuxt config augmentation
against `dist/types.d.mts`. The negative fixture's `@ts-expect-error` applies
only to the removed legacy named type import. On the Issue #11 base, the
directive is unused because the generated declarations still expose that name;
after the contraction it is consumed by the missing export error. The separate
positive fixture prevents a package-resolution error from making the negative
assertion pass accidentally.

Neither check depends on declaration whitespace, export order, diagnostic
wording, diagnostic codes, line numbers, or a full artifact snapshot.

## Release and regression coverage

The 3.0.0 changelog identifies removal of the undocumented package-root export,
states that no replacement API exists, and records it as Candidate 02's only
intentionally accepted breaking change.

The existing Nuxt E2E suite remains the regression gate:

- `test/basic.test.ts` covers SSR for a Nuxt fixture with the module enabled.
- `test/builtInRenderer.e2e.test.ts` covers the Package User Nuxt rendering
  path through the Built-in Renderer.
- `test/customRenderer.e2e.test.ts` and
  `test/customComponents.e2e.test.ts` cover Custom Renderer paths.

## Explicitly out of scope

This change does not modify the Nuxt Content hook, Markdown fence grammar,
scanner, metadata parsing or precedence, toolbar semantics, unsafe-key
filtering, Selective Fallback, unexpected failure propagation, renderer code,
diagnostics, dependencies, performance, version metadata, tags, publishing, or
release automation.
