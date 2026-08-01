# Internalize Diagram Metadata Design

## Context

Issue #9 is the metadata-ownership slice of Issue #7. Issue #8 established
`src/markdown-diagram-transform.ts` as the stable internal body-to-body entry,
but the Mermaid YAML Frontmatter and Mermaid Inline Attributes implementation
still lives under `src/runtime/utils`. That makes build-time parsing and
serialization appear to be an app-runtime capability.

## Deep-module ownership

`src/markdown-diagram-transform.ts` remains the only semantic entry. Internal
sibling code may implement per-diagram metadata parsing, precedence, toolbar
projection, unsafe-key filtering, and frontmatter serialization, but it is not
exported from the runtime utilities barrel or the package root.

The established behavior is preserved:

- Mermaid Inline Attributes override the corresponding Mermaid YAML
  Frontmatter values.
- Nested `config` and `toolbar` records retain their established deep merge.
- Toolbar props are projected independently from the encoded diagram source.
- Unsafe inline path segments (`__proto__`, `prototype`, and `constructor`)
  remain ignored.
- Invalid recognized metadata follows the established local fallback, while
  unexpected failures propagate.

Page Mermaid Config remains a separate runtime channel. The transform emits
the existing `:config="config"` binding and does not parse or merge the page
value.

## Markdown Diagram Protocol verification

Protocol tests pass transformed Markdown through the real parser exported by
`@nuxtjs/mdc/runtime`, the MDC implementation used by Nuxt Content. Assertions
normalize the parser result and verify:

- the Mermaid component identity;
- decoded diagram source and merged per-diagram frontmatter;
- the Page Mermaid Config binding and independently parsed page data;
- toolbar props; and
- invalid-frontmatter fallback.

The tests do not snapshot complete generated markup or constrain attribute
order, quote style, key order, whitespace, or equivalent encoding.

## Selective Fallback

The relocation preserves the current local catches around YAML and structured
inline parsing. The body-to-body entry does not add a per-fence or
whole-document catch. Encoding and other unexpected failures therefore remain
Content build failures.

## Out of scope

- The Nuxt Content hook in `src/module.ts` (Issue #10).
- The package-root `transformMermaidCodeBlocks` export (Issue #11).
- Fence grammar changes, new syntax, renderer behavior, diagnostics,
  dependency migration, performance work, or new extension points.

