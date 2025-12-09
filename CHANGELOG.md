# Changelog

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
