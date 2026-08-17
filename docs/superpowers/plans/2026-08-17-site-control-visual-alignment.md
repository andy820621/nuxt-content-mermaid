# Website Site Control Visual Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the locale switcher text-only, optically balance the theme and GitHub glyphs, and open the GitHub repository in a safe new tab.

**Architecture:** Preserve the existing `ThemeToggle`, `LocaleSwitcher`, Nuxt i18n routing, and 2.5rem control hit areas. Apply optical sizing only in CSS, remove the unused language icon from both markup and the static client bundle, and express the external-link behavior directly on the existing anchor.

**Tech Stack:** Nuxt 4, Vue 3, `@nuxtjs/i18n`, `@nuxt/icon`, Vitest, Nuxt Test Utils, Playwright.

## Global Constraints

- Keep `NuxtLink + switchLocalePath()` as the locale navigation mechanism.
- Keep the theme and GitHub control hit areas at 2.5rem.
- Set the theme glyph box to 1.4rem and keep the GitHub SVG at 1.25rem.
- Keep the existing Line MD static and animated theme icons.
- Add `target="_blank"` and `rel="noopener noreferrer"` to the GitHub link.
- Do not add dependencies, replace the GitHub SVG, or add screenshot tests.

---

### Task 1: Align the website header controls

**Files:**
- Modify: `website/test/siteControls.e2e.test.ts`
- Modify: `website/test/generatedSite.e2e.test.ts`
- Modify: `website/components/LocaleSwitcher.vue`
- Modify: `website/assets/css/main.css`
- Modify: `website/app.vue`
- Modify: `website/nuxt.config.ts`

**Interfaces:**
- Consumes: existing `LocaleSwitcher` route and accessible-name contract; existing `.icon-button`, `.locale-switcher`, and `.theme-toggle__icon` selectors.
- Produces: a text-only locale link, a 1.4rem theme glyph box, and an external GitHub link with safe new-tab attributes.

- [ ] **Step 1: Write failing browser assertions for the requested behavior**

In `website/test/siteControls.e2e.test.ts`, rename the English-home locale case and replace its icon assertion:

```ts
it('renders the Chinese destination as a text-only pill on the English home route', async () => {
  const page = await createSiteControlsPage()
  await page.goto(url('/'), { waitUntil: 'hydration' })

  const switcher = page.getByRole('link', { name: 'Switch to Chinese' })
  expect(await switcher.getAttribute('href')).toBe('/zh')
  expect(await switcher.getAttribute('title')).toBe('Switch to Chinese')
  expect(await switcher.textContent()).toBe('中')
  expect(await switcher.locator('.iconify').count()).toBe(0)
  expect(await switcher.evaluate(element => element.clientWidth > element.clientHeight)).toBe(true)
})
```

Add two focused cases after it:

```ts
it('optically enlarges the theme glyph relative to the GitHub glyph', async () => {
  const page = await createSiteControlsPage()
  await page.goto(url('/'), { waitUntil: 'hydration' })

  const themeGlyph = page.locator('.theme-toggle__icon--static')
  const githubGlyph = page.locator('a[href="https://github.com/andy820621/nuxt-content-mermaid"] svg')
  const themeWidth = await themeGlyph.evaluate(element => Number.parseFloat(getComputedStyle(element).width))
  const githubWidth = await githubGlyph.evaluate(element => Number.parseFloat(getComputedStyle(element).width))

  expect(themeWidth).toBeCloseTo(22.4, 1)
  expect(githubWidth).toBeCloseTo(20, 1)
  expect(themeWidth).toBeGreaterThan(githubWidth)
})

it('opens the GitHub repository in a safe new tab', async () => {
  const page = await createSiteControlsPage()
  await page.goto(url('/'), { waitUntil: 'hydration' })

  const github = page.locator('a[href="https://github.com/andy820621/nuxt-content-mermaid"]')
  expect(await github.getAttribute('target')).toBe('_blank')
  expect((await github.getAttribute('rel'))?.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer'])
})
```

In `website/test/generatedSite.e2e.test.ts`, replace the obsolete language-icon expectation with a client-bundle count assertion:

```ts
it('generates a four-icon offline client bundle without icon load failures', () => {
  expect(generateOutput).toContain('Nuxt Icon client bundle consist of 4 icons')
  expect(generateOutput).not.toContain('[Icon] failed to load icon')
})
```

Remove the `i-material-symbols-light:language` call from the offline rendering case; retain all four Line MD assertions and the blocked-request assertion.

- [ ] **Step 2: Run the narrow tests and verify RED**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run test/siteControls.e2e.test.ts test/generatedSite.e2e.test.ts
```

Expected: FAIL because the locale switcher still contains `.iconify`, the theme glyph is still 20px, the GitHub anchor lacks `target` and `rel`, and Nuxt reports a five-icon client bundle.

- [ ] **Step 3: Implement the minimal markup, CSS, and bundle changes**

In `website/components/LocaleSwitcher.vue`, remove the language `<Icon>` and keep only:

```vue
<span>{{ nextLocale === 'zh' ? '中' : 'EN' }}</span>
```

In `website/assets/css/main.css`, simplify the pill layout and apply optical sizing:

```css
.locale-switcher {
  width: auto;
  padding: 0 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.theme-toggle__icon {
  display: grid;
  grid-area: 1 / 1;
  width: 1.4rem;
  height: 1.4rem;
  place-items: center;
  transition: opacity 160ms ease, transform 160ms ease;
}
```

In `website/app.vue`, add the external-link attributes to the existing GitHub anchor:

```vue
target="_blank"
rel="noopener noreferrer"
```

In `website/nuxt.config.ts`, leave the four Line MD names unchanged and remove:

```ts
'material-symbols-light:language',
```

- [ ] **Step 4: Run narrow tests and verify GREEN**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run test/siteControls.e2e.test.ts test/generatedSite.e2e.test.ts
```

Expected: both files pass; generated-site assertions confirm four bundled icons and no runtime icon request.

- [ ] **Step 5: Run the complete verification gates**

Run each command separately:

```bash
pnpm --filter nuxt-content-mermaid-website exec nuxt prepare
pnpm exec vue-tsc -p website/tsconfig.json --noEmit
pnpm --filter nuxt-content-mermaid-website exec vitest run
pnpm --filter nuxt-content-mermaid-website exec nuxt generate
pnpm lint
pnpm test
git diff --check
```

Expected: all commands exit 0; website tests and root tests report zero failures; generate reports four client-bundled icons and no icon load failure.

- [ ] **Step 6: Commit the implementation**

```bash
git add website/test/siteControls.e2e.test.ts website/test/generatedSite.e2e.test.ts website/components/LocaleSwitcher.vue website/assets/css/main.css website/app.vue website/nuxt.config.ts
git commit -m "style(website): align site controls"
```
