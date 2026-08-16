# Homepage Tab Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage demo's `MD`／`UI` badges with semantic outline icons and make the selected tab unmistakable in both themes through accent text, weight, and a 3px underline.

**Architecture:** Keep `LandingMermaidDemo`'s state, ARIA, keyboard navigation, source reconstruction, and real transport rendering unchanged. Replace only the tab trigger glyph markup and its CSS state presentation; use existing theme tokens and inline SVGs, with no new dependency or shared icon abstraction.

**Tech Stack:** Nuxt 4.5.2, Vue 3.5, TypeScript, CSS, Vitest 4.1.10, `@nuxt/test-utils`, Playwright.

## Global Constraints

- Keep the exact labels `Markdown` and `Rendered UI`.
- Keep `Rendered UI` active by default.
- Keep the existing tab IDs, ARIA relationships, roving `tabindex`, click handling, and Arrow／Home／End keyboard behavior.
- Keep `ContentRenderer`, `ContentMermaidTransport`, source reconstruction, Mermaid toolbar, and panels unchanged.
- Use 18px inline outline SVGs with `currentColor`, no fill, and `aria-hidden="true"`.
- Do not add an icon dependency or a reusable icon component.
- Active state must use `var(--accent-strong)`, increased font weight, and a 3px `var(--accent)` underline.
- Dark mode may add only a low-intensity underline glow; no solid active pill or sliding animation.
- Preserve 320px page-level horizontal-overflow support.

---

## File Structure

- Modify `website/components/LandingMermaidDemo.vue`: remove badge data/markup and render the two approved inline SVG glyphs.
- Modify `website/assets/css/main.css`: replace badge/pill styling with outline-icon, inactive hover, active text, underline, and dark-glow rules.
- Modify `website/test/landingHero.e2e.test.ts`: protect icon semantics and computed active styling in light/dark themes while retaining existing behavior coverage.
- Modify `docs/specs/homepage-hero-source-preview.md`: record the approved tab visual language in the homepage design contract.
- Modify `docs/specs/documentation-website.md`: reconcile the canonical stage/acceptance text with the outline-icon and underline treatment.

### Task 1: Implement the outline-icon underline tabs

**Files:**
- Modify: `website/test/landingHero.e2e.test.ts:19-85`
- Modify: `website/components/LandingMermaidDemo.vue:16-19`
- Modify: `website/components/LandingMermaidDemo.vue:64-84`
- Modify: `website/assets/css/main.css:302-335`

**Interfaces:**
- Consumes: existing `DemoTab`, `activeTab`, tab IDs, `aria-selected`, and theme tokens from `website/assets/css/main.css`.
- Produces: `.landing-demo__tab-icon`; `.landing-demo__tab--active::after` with a 3px underline; unchanged accessible names `Markdown` and `Rendered UI`.

- [ ] **Step 1: Add the failing visual-state browser test**

Append this test inside the existing `describe` block in `website/test/landingHero.e2e.test.ts`:

```ts
it('uses outline icons and an underline active state in both themes', async () => {
  const page = await createPage()
  await page.goto(url('/'))

  const sourceTab = page.getByRole('tab', { name: 'Markdown' })
  const previewTab = page.getByRole('tab', { name: 'Rendered UI' })
  const readTabStyle = (tab: typeof previewTab) => tab.evaluate((element) => {
    const style = getComputedStyle(element)
    const underline = getComputedStyle(element, '::after')
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      fontWeight: Number.parseInt(style.fontWeight, 10),
      underlineHeight: underline.height,
      underlineColor: underline.backgroundColor,
      underlineShadow: underline.boxShadow,
    }
  })

  expect(await sourceTab.locator('.landing-demo__tab-icon').count()).toBe(1)
  expect(await previewTab.locator('.landing-demo__tab-icon').count()).toBe(1)
  expect(await page.locator('.landing-demo__tab-badge').count()).toBe(0)

  const lightActive = await readTabStyle(previewTab)
  const lightInactive = await readTabStyle(sourceTab)
  expect(lightActive.color).not.toBe(lightInactive.color)
  expect(lightActive.fontWeight).toBeGreaterThan(lightInactive.fontWeight)
  expect(lightActive.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  expect(lightActive.underlineHeight).toBe('3px')
  expect(lightActive.underlineColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(lightActive.underlineShadow).toBe('none')

  await sourceTab.click()
  expect((await readTabStyle(sourceTab)).underlineHeight).toBe('3px')

  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')

  const darkActive = await readTabStyle(sourceTab)
  const darkInactive = await readTabStyle(previewTab)
  expect(darkActive.color).not.toBe(darkInactive.color)
  expect(darkActive.underlineHeight).toBe('3px')
  expect(darkActive.underlineShadow).not.toBe('none')
})
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
pnpm --dir website test -- --testNamePattern="uses outline icons"
```

Expected: FAIL because `.landing-demo__tab-icon` count is `0` and the existing active tab is a filled surface pill without a pseudo-element underline.

- [ ] **Step 3: Remove badge data from the tab model**

Replace the `tabs` declaration in `website/components/LandingMermaidDemo.vue` with:

```ts
const tabs = [
  { id: 'source', label: 'Markdown' },
  { id: 'preview', label: 'Rendered UI' },
] as const
```

- [ ] **Step 4: Replace the badge with the approved inline SVGs**

Replace the `.landing-demo__tab-badge` span inside the tab button with:

```vue
<svg
  v-if="tab.id === 'source'"
  class="landing-demo__tab-icon"
  aria-hidden="true"
  viewBox="0 0 24 24"
>
  <path d="M6 3h8l4 4v14H6z" />
  <path d="M14 3v5h5M9 13l-2 2 2 2M15 13l2 2-2 2M13 12l-2 6" />
</svg>
<svg
  v-else
  class="landing-demo__tab-icon"
  aria-hidden="true"
  viewBox="0 0 24 24"
>
  <rect
    x="3"
    y="4"
    width="18"
    height="16"
    rx="2"
  />
  <path d="M3 9h18M7 6.5h.01M10 6.5h.01M8 14h3M13 12h3M13 16h3" />
</svg>
{{ tab.label }}
```

Do not add `<title>` elements: both SVGs are decorative and `aria-hidden`, while the visible labels provide the accessible names.

- [ ] **Step 5: Replace pill/badge CSS with icon and underline states**

Keep the existing `.landing-demo__tab` layout declarations, add `position: relative`, and replace its hover/active/badge rules with this exact block:

```css
.landing-demo__tab {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-radius: 0.55rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
}

.landing-demo__tab:hover:not(.landing-demo__tab--active) {
  color: var(--text);
  background: var(--surface-elevated);
}

.landing-demo__tab--active {
  color: var(--accent-strong);
  background: transparent;
  font-weight: 730;
}

.landing-demo__tab--active::after {
  position: absolute;
  right: 0.7rem;
  bottom: calc(-0.55rem - 1px);
  left: 0.7rem;
  height: 3px;
  background: var(--accent);
  border-radius: 3px 3px 0 0;
  content: "";
  pointer-events: none;
}

html[data-theme='dark'] .landing-demo__tab--active::after {
  box-shadow: 0 -3px 10px color-mix(in srgb, var(--accent) 32%, transparent);
}

.landing-demo__tab-icon {
  flex: none;
  width: 1.125rem;
  height: 1.125rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}
```

Delete the entire `.landing-demo__tab-badge` rule. Do not add transitions or an animated/sliding indicator.

- [ ] **Step 6: Run the focused and complete website behavior tests**

Run:

```bash
pnpm --dir website test -- --testNamePattern="uses outline icons"
pnpm --dir website test
```

Expected: the focused test passes, then all four homepage E2E tests pass. Existing H3 unused-import warnings are allowed; any failed assertion is not.

- [ ] **Step 7: Commit the self-contained UI behavior**

```bash
git add website/components/LandingMermaidDemo.vue website/assets/css/main.css website/test/landingHero.e2e.test.ts
git commit -m "style(website): refine homepage demo tabs"
```

### Task 2: Reconcile contracts and verify the finished UI

**Files:**
- Modify: `docs/specs/homepage-hero-source-preview.md:118-122`
- Modify: `docs/specs/documentation-website.md:302-308`
- Modify: `docs/specs/documentation-website.md:537-548`
- Modify: `docs/specs/documentation-website.md:584-605`

**Interfaces:**
- Consumes: `.landing-demo__tab-icon` and `.landing-demo__tab--active` behavior produced by Task 1.
- Produces: canonical design language and fresh verification evidence for the completed branch.

- [ ] **Step 1: Update the homepage visual contract**

Append this paragraph after the first paragraph under `## Visual design` in `docs/specs/homepage-hero-source-preview.md`:

```markdown
The tab triggers use 18px single-color outline icons rather than `MD`／`UI` badges. The active view is expressed through `var(--accent-strong)` text and icon color, increased weight, and a 3px `var(--accent)` underline. Dark mode adds only a low-intensity underline glow; active tabs do not use a solid pill. Focus remains a separate visible outline so selection and keyboard position are never conflated.
```

- [ ] **Step 2: Update the canonical documentation website contract**

In the stage-seven table row for `website/assets/css/main.css`, change its responsibility to:

```markdown
放鬆 hero 字距、重新分配欄寬，加入 tab frame、outline glyph、underline active state 與 narrow viewport containment。
```

Append this sentence to acceptance criterion 7:

```markdown
兩個 trigger 使用 outline icon；active 同時由 accent 文字、較高字重與 3px underline 表達，dark theme 的低強度 glow 不取代 focus outline。
```

- [ ] **Step 3: Run repository formatting and production verification**

Run these commands in order:

```bash
pnpm lint --fix
pnpm --dir website test
pnpm --dir website generate
pnpm test
pnpm test:types
git diff --check
```

Expected:

- ESLint exits `0` without unrelated rewrites.
- Website E2E reports four passing tests.
- Nuxt static generation prerenders `/` and the five documentation routes.
- Root Vitest reports 45 passing test files and 425 passing tests unless the repository's independent test count has legitimately changed.
- Root and playground `vue-tsc` exit `0`.
- `git diff --check` prints nothing.

- [ ] **Step 4: Perform responsive light/dark visual verification**

Run:

```bash
pnpm --dir website dev --host 127.0.0.1
```

Inspect `/` with the browser at 1280px, 768px, and 320px. At each width:

1. Verify both outline icons are visually aligned with their labels and do not resemble independent badges.
2. Activate `Rendered UI`, then `Markdown`; verify accent color, increased weight, and underline move together.
3. Switch to dark mode; verify the active underline glow is visible but does not overpower the tab label or panel.
4. Focus each tab with the keyboard; verify the focus outline remains distinct from the active underline and is not clipped.
5. At 320px, verify both labels remain understandable, the tablist may scroll internally if needed, and `document.documentElement.scrollWidth - document.documentElement.clientWidth` is `0`.

Stop the dev server after inspection.

- [ ] **Step 5: Commit the reconciled contracts**

```bash
git add docs/specs/homepage-hero-source-preview.md docs/specs/documentation-website.md
git commit -m "docs: record homepage tab visual language"
```

- [ ] **Step 6: Confirm final branch scope**

Run:

```bash
git status --short
git log -5 --oneline --decorate
```

Expected: only the pre-existing untracked `.superpowers/` visual-companion directory remains; implementation and documentation commits are on `feat/BarZ/website`, with no push or merge performed.
