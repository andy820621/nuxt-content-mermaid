# Changelog

## v3.0.0

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.2.3...v3.0.0)

### ⚠️ Breaking Changes

- Adopt the Nuxt 4 dependency contract: Node.js `>=22.19.0`, Nuxt `^4.1.0`, and `@nuxt/content >=3.5.0 <4.0.0` are now required ([6f8643e](https://github.com/andy820621/nuxt-content-mermaid/commit/6f8643e)). Nuxt 3 users should remain on the frozen 2.x line.
- Define the v3 configuration contract and public types ([#33](https://github.com/andy820621/nuxt-content-mermaid/pull/33)): rename the removed `mermaidContent` alias to `contentMermaid`, keep `enabled` in build-time module configuration, and transport only pure data through public runtime configuration.
- Route configuration authored in Markdown through the `pageConfig` prop ([9507482](https://github.com/andy820621/nuxt-content-mermaid/commit/9507482)). Direct component usage continues to use `config`; supplying both sources is an error.
- Remove the undocumented package-root `transformMermaidCodeBlocks` export ([#15](https://github.com/andy820621/nuxt-content-mermaid/pull/15)). Install the module through its default export and let it own Markdown transformation.

### 🚀 Highlights

- Add SSR-safe, transactional Mermaid rendering so stale or failed renders cannot replace the latest successfully committed diagram ([#5](https://github.com/andy820621/nuxt-content-mermaid/pull/5), [#24](https://github.com/andy820621/nuxt-content-mermaid/pull/24), [#35](https://github.com/andy820621/nuxt-content-mermaid/pull/35)).
- Isolate configuration by Nuxt application and component invocation, with frozen runtime snapshots and deterministic recovery from reactive source conflicts ([#34](https://github.com/andy820621/nuxt-content-mermaid/pull/34), [#37](https://github.com/andy820621/nuxt-content-mermaid/pull/37), [#40](https://github.com/andy820621/nuxt-content-mermaid/pull/40), [#41](https://github.com/andy820621/nuxt-content-mermaid/pull/41)).
- Make renderer selection and fallback handoff deterministic, with public diagnostics when renderer resolution fails ([#49](https://github.com/andy820621/nuxt-content-mermaid/pull/49), [#51](https://github.com/andy820621/nuxt-content-mermaid/pull/51), [#52](https://github.com/andy820621/nuxt-content-mermaid/pull/52)).

### 📘 Migration

Follow the [v3 migration guide](./docs/en/MIGRATION_V3.md) for configuration examples and the [dependency and migration contract](./docs/en/DEPENDENCY_AND_MIGRATION_CONTRACT.md) for the complete 3.x support policy.

### ❤️ Contributors

- [@BarZ](https://github.com/andy820621) - <andy820621@gmail.com>

## v2.2.3

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.2.2...v2.2.3)

### 🩹 Fixes

- Use relative import path and fix TS 5.9 type errors ([ff62dc8](https://github.com/andy820621/nuxt-content-mermaid/commit/ff62dc8))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.2.2

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.2.1...v2.2.2)

### 🩹 Fixes

- Pre-bundle mermaid CJS deps for pnpm strict mode ([50d258f](https://github.com/andy820621/nuxt-content-mermaid/commit/50d258f))
- Add default export ([960e7ee](https://github.com/andy820621/nuxt-content-mermaid/commit/960e7ee))
- Include missing dayjs duration plugin in optimizeDeps ([b47d3fa](https://github.com/andy820621/nuxt-content-mermaid/commit/b47d3fa))

### 🏡 Chore

- Update dependencies ([607fd20](https://github.com/andy820621/nuxt-content-mermaid/commit/607fd20))

### ✅ Tests

- Verify mermaid optimizeDeps injection in module setup ([d190633](https://github.com/andy820621/nuxt-content-mermaid/commit/d190633))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.2.1

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.2.0...v2.2.1)

### 🎨 Styles

- Use :where() for root and dark theme selectors in styles.css ([7c33d98](https://github.com/andy820621/nuxt-content-mermaid/commit/7c33d98))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.2.0

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.1.3...v2.2.0)

### 🚀 Enhancements

- Add Mermaid toolbar with expand/fullscreen/copy and inline config support ([a5b573d](https://github.com/andy820621/nuxt-content-mermaid/commit/a5b573d))
- **expand:** Add pan/zoom support for expand overlay ([abe470b](https://github.com/andy820621/nuxt-content-mermaid/commit/abe470b))
- **fullscreen:** Add fullscreen pan/zoom support for Mermaid ([fb2af3d](https://github.com/andy820621/nuxt-content-mermaid/commit/fb2af3d))

### 📖 Documentation

- Add pan & zoom interaction details and hint toast CSS variables to README ([a1b45f2](https://github.com/andy820621/nuxt-content-mermaid/commit/a1b45f2)), ([12c1f7a](https://github.com/andy820621/nuxt-content-mermaid/commit/12c1f7a))

### ✅ Tests

- Add zoom/expand unit tests and toolbar e2e coverage ([235aee0](https://github.com/andy820621/nuxt-content-mermaid/commit/235aee0))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.1.3

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.1.2...v2.1.3)

### 🚀 Enhancements

- Enhance mermaid fenced block conversion and support ~~~mermaid ([e0e924b](https://github.com/andy820621/nuxt-content-mermaid/commit/e0e924b))

### 🏡 Chore

- Update docs & add social-card ([5b29358](https://github.com/andy820621/nuxt-content-mermaid/commit/5b29358))
- **playground:** Improve content layout and syntax highlighting ([cc228c5](https://github.com/andy820621/nuxt-content-mermaid/commit/cc228c5))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.1.2

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.1.1...v2.1.2)

### 🩹 Fixes

- Stabilize spinner loading experience ([abf7efd](https://github.com/andy820621/nuxt-content-mermaid/commit/abf7efd))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.1.1

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.0.1...v2.1.1)

### 🚀 Enhancements

- **theme:** ⚠️  Add useMermaidTheme composable for manual theme control ([3105f7e](https://github.com/andy820621/nuxt-content-mermaid/commit/3105f7e))

### 🩹 Fixes

- Auto-import useMermaidTheme composable ([703770c](https://github.com/andy820621/nuxt-content-mermaid/commit/703770c))

### 📖 Documentation

- Clarify frontmatter config schema requirement ([e5df40a](https://github.com/andy820621/nuxt-content-mermaid/commit/e5df40a))
- Update useMermaidTheme composable documentation ([da25ff4](https://github.com/andy820621/nuxt-content-mermaid/commit/da25ff4))

### 🏡 Chore

- Add changelog configuration file ([afb284f](https://github.com/andy820621/nuxt-content-mermaid/commit/afb284f))

### ✅ Tests

- Add addImports to @nuxt/kit mock ([4e5fc89](https://github.com/andy820621/nuxt-content-mermaid/commit/4e5fc89))

#### ⚠️ Breaking Changes

- **theme:** ⚠️  Add useMermaidTheme composable for manual theme control ([3105f7e](https://github.com/andy820621/nuxt-content-mermaid/commit/3105f7e))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.1.0-alpha.1

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.0.1...v2.1.0-alpha.1)

### 🚀 Enhancements

- **theme:** ⚠️  Add useMermaidTheme composable for manual theme control ([3105f7e](https://github.com/andy820621/nuxt-content-mermaid/commit/3105f7e))

### 🩹 Fixes

- Auto-import useMermaidTheme composable ([703770c](https://github.com/andy820621/nuxt-content-mermaid/commit/703770c))

### 📖 Documentation

- Clarify frontmatter config schema requirement ([e5df40a](https://github.com/andy820621/nuxt-content-mermaid/commit/e5df40a))

### 🏡 Chore

- **release:** Add pre-release scripts for minor versions (alpha, beta, rc) ([1ee92b2](https://github.com/andy820621/nuxt-content-mermaid/commit/1ee92b2))
- **release:** V2.1.0-alpha.0 ([9ed785a](https://github.com/andy820621/nuxt-content-mermaid/commit/9ed785a))
- **release:** Add prerelease scripts for alpha/beta/rc patch versions ([3ce12c6](https://github.com/andy820621/nuxt-content-mermaid/commit/3ce12c6))

### ✅ Tests

- Add addImports to @nuxt/kit mock ([4e5fc89](https://github.com/andy820621/nuxt-content-mermaid/commit/4e5fc89))

#### ⚠️ Breaking Changes

- **theme:** ⚠️  Add useMermaidTheme composable for manual theme control ([3105f7e](https://github.com/andy820621/nuxt-content-mermaid/commit/3105f7e))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.1.0-alpha.0

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.0.1...v2.1.0-alpha.0)

### 🚀 Enhancements

- **theme:** ⚠️  Remove useColorModeTheme toggle and implement Strict Semantic Resolution ([f7aaf88](https://github.com/andy820621/nuxt-content-mermaid/commit/f7aaf88))

### 📖 Documentation

- Clarify frontmatter config schema requirement ([e5df40a](https://github.com/andy820621/nuxt-content-mermaid/commit/e5df40a))

### 🏡 Chore

- **release:** Add pre-release scripts for minor versions (alpha, beta, rc) ([eb67e1c](https://github.com/andy820621/nuxt-content-mermaid/commit/eb67e1c))

#### ⚠️ Breaking Changes

- **theme:** ⚠️  Remove useColorModeTheme toggle and implement Strict Semantic Resolution ([f7aaf88](https://github.com/andy820621/nuxt-content-mermaid/commit/f7aaf88))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.0.1

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v2.0.0...v2.0.1)

### 🩹 Fixes

- Pre-bundle @braintree/sanitize-url to resolve named export errors ([1d36b83](https://github.com/andy820621/nuxt-content-mermaid/commit/1d36b83))
- Center SVG diagrams by setting display inline-block ([75d08d4](https://github.com/andy820621/nuxt-content-mermaid/commit/75d08d4))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v2.0.0

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v1.0.4...v2.0.0)

### 🚀 Enhancements

- ⚠️  Bundle mermaid dependency and simplify loader config ([2243bc6](https://github.com/andy820621/nuxt-content-mermaid/commit/2243bc6))
- Support per-page Mermaid config and playground catalog ([e3eb6c8](https://github.com/andy820621/nuxt-content-mermaid/commit/e3eb6c8))
- Add contentMermaid config key and deprecate mermaidContent ([06d3734](https://github.com/andy820621/nuxt-content-mermaid/commit/06d3734))
- **playground:** Enhance mermaid demo page styling ([1aca557](https://github.com/andy820621/nuxt-content-mermaid/commit/1aca557))
- **playground:** Enhance layout and styling of Mermaid Playground, add new class diagrams ([effba4f](https://github.com/andy820621/nuxt-content-mermaid/commit/effba4f))
- Add catalog page variant with cyan color scheme and update Mermaid rendering logic ([325a3dc](https://github.com/andy820621/nuxt-content-mermaid/commit/325a3dc))
- Add configuration options for class diagrams and implement basic state diagram ([2d23314](https://github.com/andy820621/nuxt-content-mermaid/commit/2d23314))
- Add ER diagrams for customers & orders and content tagging ([3e07d50](https://github.com/andy820621/nuxt-content-mermaid/commit/3e07d50))
- **playground:** Add comprehensive Mermaid diagram examples ([18b182f](https://github.com/andy820621/nuxt-content-mermaid/commit/18b182f))
- Add tests for multiple mermaid block transformations and module setup ([8591da4](https://github.com/andy820621/nuxt-content-mermaid/commit/8591da4))
- Add Playwright for end-to-end testing and implement color mode theme switching tests ([9517534](https://github.com/andy820621/nuxt-content-mermaid/commit/9517534))
- Add debug mode for diagnostic logging and error reporting ([80e90e5](https://github.com/andy820621/nuxt-content-mermaid/commit/80e90e5))

### 🩹 Fixes

- Improve Mermaid source extraction and add sequence demo ([c960175](https://github.com/andy820621/nuxt-content-mermaid/commit/c960175))
- Add Playwright browser installation step in CI workflow ([073d576](https://github.com/andy820621/nuxt-content-mermaid/commit/073d576))

### 💅 Refactors

- Encode mermaid blocks using code prop and simplify runtime extraction ([93e19e1](https://github.com/andy820621/nuxt-content-mermaid/commit/93e19e1))

### ✅ Tests

- **e2e:** Add tests for custom components and renderer configuration ([b2692f6](https://github.com/andy820621/nuxt-content-mermaid/commit/b2692f6))

#### ⚠️ Breaking Changes

- ⚠️  Bundle mermaid dependency and simplify loader config ([2243bc6](https://github.com/andy820621/nuxt-content-mermaid/commit/2243bc6))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v1.0.4

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v1.0.3...v1.0.4)

### 🩹 Fixes

- Change release scripts to use pnpm ([52eb4a2](https://github.com/andy820621/nuxt-content-mermaid/commit/52eb4a2))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v1.0.3

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v1.0.2...v1.0.3)

### 🩹 Fixes

- Clear mermaid processed flag before rerender ([0244573](https://github.com/andy820621/nuxt-content-mermaid/commit/0244573))

### 📖 Documentation

- Update deps & installation instructions in README files ([b19ed92](https://github.com/andy820621/nuxt-content-mermaid/commit/b19ed92))

### 🏡 Chore

- Migrate to pnpm catalogs and align compatibility ranges ([bab7d15](https://github.com/andy820621/nuxt-content-mermaid/commit/bab7d15))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v1.0.2

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v1.0.1...v1.0.2)

### 🚀 Enhancements

- Queue mermaid renders and refine custom components ([2813b1a](https://github.com/andy820621/nuxt-content-mermaid/commit/2813b1a))
- Extend NuxtConfig and NuxtOptions interfaces to include mermaidContent ([8c20d2f](https://github.com/andy820621/nuxt-content-mermaid/commit/8c20d2f))
- Make mermaid loader lazy behavior configurable ([86c658c](https://github.com/andy820621/nuxt-content-mermaid/commit/86c658c))
- Add error handling support for Mermaid rendering ([ec01e65](https://github.com/andy820621/nuxt-content-mermaid/commit/ec01e65))

### 🏡 Chore

- Refactor release scripts for better versioning control ([dc73c38](https://github.com/andy820621/nuxt-content-mermaid/commit/dc73c38))
- Add TODOLIST to .gitignore ([c487e16](https://github.com/andy820621/nuxt-content-mermaid/commit/c487e16))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v1.0.1

[compare changes](https://github.com/andy820621/nuxt-content-mermaid/compare/v1.0.0...v1.0.1)

### 🚀 Enhancements

- Update module description to clarify functionality and features ([bb4a21d](https://github.com/andy820621/nuxt-content-mermaid/commit/bb4a21d))

### 🩹 Fixes

- Move constants to runtime directory and update imports ([f71b2de](https://github.com/andy820621/nuxt-content-mermaid/commit/f71b2de))

### ❤️ Contributors

- BarZ <andy820621@gmail.com>

## v1.0.0

- Initial release of `@barzhsieh/nuxt-content-mermaid`.
