# Documentation Code Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fenced and inline code clearly readable in both website themes, especially dark mode, while preserving the existing Nuxt Content architecture.

**Architecture:** Keep Nuxt Content／MDC as the build-time Shiki highlighter. Configure `github-light` plus `github-dark-high-contrast`, then adapt Nuxt's dark-token CSS mechanism to the website's existing `html[data-theme='dark']` contract. Use plain CSS for fenced and inline code presentation; do not add components or runtime behavior.

**Tech Stack:** Nuxt 4.5.2, Nuxt Content 3.15.2, MDC/Shiki, CSS, in-app browser inspection.

## Global Constraints

- The normative contract is `docs/specs/documentation-website.md`, especially **程式碼閱讀體驗** and **第六階段檔案變更範圍**.
- Product implementation may modify only `website/nuxt.config.ts` and `website/assets/css/main.css`.
- Do not modify Markdown, Vue components, routes, layouts, navigation, Mermaid runtime, brand assets, dependencies, workspace, root scripts, CI, artifact, or release files.
- Do not add Prose／MDC components, a client-side highlighter, copy controls, title bars, tabs, line numbers, permanent tests, snapshots, manifests, or website verifiers.
- Keep `github-light` for light mode and use exactly `github-dark-high-contrast` for dark mode.
- Continue using `html[data-theme='dark']`; do not introduce a `.dark` root class or another theme state.
- Website checks remain one-time local evidence and never become a root／CI／release contract.

---

### Task 1: Apply the high-contrast Shiki theme and code presentation

**Files:**

- Modify: `website/nuxt.config.ts`
- Modify: `website/assets/css/main.css`

**Interfaces:**

- Consumes: Nuxt Content's existing MDC `highlight.theme` option and emitted `--shiki-dark*` custom properties.
- Produces: build-time `github-light`／`github-dark-high-contrast` tokens and CSS presentation keyed by `html[data-theme='dark']`.

- [ ] **Step 1: Run the one-time structural assertion and verify RED**

Run from the repository root:

```bash
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs'

const config = readFileSync('website/nuxt.config.ts', 'utf8')
const css = readFileSync('website/assets/css/main.css', 'utf8')
const expectations = [
  ['light Shiki theme', config.includes("default: 'github-light'")],
  ['dark Shiki theme', config.includes("dark: 'github-dark-high-contrast'")],
  ['data-theme dark selector', css.includes("html[data-theme='dark'] .shiki span")],
  ['fenced code wrapping', css.includes('white-space: pre-wrap') && css.includes('overflow-wrap: break-word')],
  ['inline code selector', css.includes('.docs-content :not(pre) > code')],
]
const missing = expectations.filter(([, present]) => !present).map(([name]) => name)
if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`)
  process.exit(1)
}
NODE
```

Expected: FAIL and report all or most of the five missing contracts.

- [ ] **Step 2: Configure the existing MDC highlighter**

Add this top-level option in `website/nuxt.config.ts`, adjacent to the existing `css` configuration:

```ts
mdc: {
  highlight: {
    theme: {
      default: 'github-light',
      dark: 'github-dark-high-contrast',
    },
  },
},
```

Do not install Shiki or add a direct dependency; MDC already owns theme loading.

- [ ] **Step 3: Apply dark Shiki token properties through the existing theme attribute**

Add this rule to `website/assets/css/main.css` after the global `code` font-family rule:

```css
html[data-theme='dark'] .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}
```

This mirrors Nuxt's dark-token mechanism but uses the website's `data-theme` contract.

- [ ] **Step 4: Improve fenced code readability without adding UI**

Extend the existing `.docs-content pre` rule so it contains the following presentation properties in addition to its current surface, border, padding, radius, and `overflow: auto`:

```css
font-size: 0.875rem;
line-height: 1.7;
white-space: pre-wrap;
overflow-wrap: break-word;
scrollbar-color: var(--border) transparent;
scrollbar-width: thin;
```

Do not remove `overflow: auto`; it remains the fallback for content that still cannot wrap.

- [ ] **Step 5: Give inline code a lightweight code-chip treatment**

Add immediately after `.docs-content pre`:

```css
.docs-content :not(pre) > code {
  padding: 0.125rem 0.375rem;
  background: var(--surface);
  border-radius: 0.375rem;
  font-size: 0.875em;
}
```

Keep inline code as ordinary semantic `<code>`; do not add syntax highlighting, links, or Vue components.

- [ ] **Step 6: Re-run the structural assertion and validate Nuxt configuration**

Re-run the exact Node assertion from Step 1.

Expected: PASS with exit code `0` and no output.

Then run:

```bash
pnpm --dir website exec nuxi prepare
git diff --check
```

Expected: both commands exit `0`; no new tracked files outside the two implementation files.

- [ ] **Step 7: Commit the focused implementation**

```bash
git add website/nuxt.config.ts website/assets/css/main.css
git commit -m "style(website): improve documentation code readability"
```

---

### Task 2: Generate and inspect every code presentation path

**Files:**

- Verify: `website/nuxt.config.ts`
- Verify: `website/assets/css/main.css`
- Modify after successful verification: `docs/specs/documentation-website.md`
- Delete after successful verification: `docs/superpowers/plans/2026-08-15-documentation-code-readability.md`

**Interfaces:**

- Consumes: Task 1's generated Shiki theme variables and CSS selectors.
- Produces: one-time generate/browser evidence and a completed normative-spec status; no permanent verifier.

- [ ] **Step 1: Generate the static website once**

Run:

```bash
pnpm --dir website generate
```

Expected: exit code `0` and generated routes for `/`, `/getting-started`, `/writing-diagrams`, `/configuration`, `/troubleshooting`, and `/migration/v3`. Existing upstream chunk-size or H3 unused-import warnings are acceptable; new errors are not.

- [ ] **Step 2: Confirm generated Shiki output uses the approved themes**

Run:

```bash
rg -q --fixed-strings 'github-light github-dark-high-contrast' website/.output/public/getting-started/index.html
rg -q --fixed-strings -- '--shiki-dark:#F0F3F6' website/.output/public/getting-started/index.html
```

Expected: both commands exit `0`, proving the output contains the high-contrast dark theme and its foreground token.

- [ ] **Step 3: Inspect desktop light and dark rendering**

Start `pnpm --dir website dev --host 127.0.0.1`, then use the in-app browser at `1440 × 1000` for:

- `/getting-started`
- `/writing-diagrams`
- `/configuration`
- `/troubleshooting`
- `/migration/v3`

For both light and dark modes, inspect these exact selectors and expectations:

```text
.docs-content pre.shiki
  font-size = 14px
  white-space = pre-wrap
  overflow-wrap = break-word

.docs-content :not(pre) > code
  background-color is not transparent
  padding = 2px 6px
  border-radius = 6px
```

In dark mode, every highlighted inner token with a non-empty `--shiki-dark` value must have its computed `color` equal to that variable rather than the light token. Across the five routes, the minimum token-to-`pre` background contrast must be at least `7:1`. Troubleshooting has inline code but no fenced block, so only its inline-code expectations apply.

- [ ] **Step 4: Inspect mobile wrapping and overflow**

At `390 × 844`, inspect Getting Started and Writing Diagrams in light and dark modes:

```text
document.documentElement.scrollWidth === document.documentElement.clientWidth
.docs-content pre.shiki white-space === 'pre-wrap'
the install command remains inside the content column without a large horizontal scrollbar
inline code remains visually distinct without forcing paragraph overflow
```

Also confirm the existing hamburger, active navigation, theme toggle, GitHub link, Mermaid diagram, and Mermaid toolbar still behave as before. Browser warning/error logs must be empty.

- [ ] **Step 5: Correct only scope-local findings and repeat affected checks**

If a check fails, modify only `website/nuxt.config.ts` or `website/assets/css/main.css`, rerun `pnpm --dir website generate`, and repeat the affected desktop/mobile theme matrix. Do not add a test file, script, component, dependency, or verifier. Commit any necessary correction separately with a focused Conventional Commit message.

- [ ] **Step 6: Mark the normative spec complete and remove the finished plan**

In `docs/specs/documentation-website.md`, change the sixth status entry from:

```text
- 2026-08-15：核准第六階段 code readability 優化，以正確的 Shiki dark tokens、高對比暗色 palette 與一致的 inline／fenced code 排版改善閱讀體驗；等待實作。
```

to:

```text
- 2026-08-15：完成第六階段 code readability 優化，以正確的 Shiki dark tokens、高對比暗色 palette 與一致的 inline／fenced code 排版改善閱讀體驗。
```

Delete this completed implementation plan from the latest file tree. It remains available in Git history.

- [ ] **Step 7: Run final boundary checks and commit documentation completion**

Run:

```bash
git diff --check
git status --short
```

Expected before the documentation commit: only the normative spec modification and this plan deletion are pending.

Commit:

```bash
git add docs/specs/documentation-website.md docs/superpowers/plans/2026-08-15-documentation-code-readability.md
git commit -m "docs: complete code readability rollout"
```

Finally run `git status --short`; expected output is empty.
