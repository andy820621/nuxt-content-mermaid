# Package Identity Metadata Design

## Goal

Make the npm package identity and its canonical project links explicit without
changing the repository title, README heading structure, or runtime behavior.

## Scope

- Add `homepage` and `bugs` metadata to `package.json`.
- Prefix the introductory summary in both English and Traditional Chinese
  READMEs with the complete package name, `@barzhsieh/nuxt-content-mermaid`.
- Keep the existing H1, badges, descriptions, and all runtime code unchanged.

## Design

`package.json` will declare the maintained project page as `homepage` and the
GitHub issue tracker as `bugs`. The new fields will sit beside `repository` so
the package's source, documentation, and support endpoints remain easy to read
as one metadata group.

The first prose sentence in each README will identify the complete scoped npm
package name in bold. The sentence will otherwise preserve the existing
description and links. This makes the npm identity visible early without
turning the README H1 into a search-engine-specific string.

## Verification

- Parse `package.json` as JSON and assert the two new URLs.
- Confirm both README introductions contain the complete scoped package name.
- Run `pnpm lint` to catch repository formatting or style regressions.

