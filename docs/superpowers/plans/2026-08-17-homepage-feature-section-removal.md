# Homepage Feature Section Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicated numbered feature-card section so the documentation homepage ends after its existing hero and real Markdown／Rendered UI demo.

**Architecture:** Keep the landing page's current Nuxt Content query, metadata, CTA, and `ContentRenderer` pipeline unchanged. Remove the feature presentation as one vertical slice—rendered markup, locale-only copy, and CSS—then reconcile the canonical website specification with the approved removal contract.

**Tech Stack:** Nuxt 4, Vue 3 SFCs, `@nuxt/content`, `@nuxtjs/i18n`, CSS, Vitest, `@nuxt/test-utils/e2e`, Playwright.

## Global Constraints

- The approved contract is `docs/specs/homepage-feature-section-removal.md`.
- The existing title, description, `Get started` CTA, CTA destination, Mermaid source, Markdown／Rendered UI tabs, and rendering pipeline remain unchanged.
- Do not add an install command, replacement section, benefit strip, final CTA, screenshots, metrics, testimonials, or integrations.
- Remove every feature-only translation key and CSS selector; do not leave dead presentation code.
- Preserve English and Traditional Chinese routes, light and dark themes, keyboard behavior, heading structure, and 320 px overflow behavior.
- Do not modify `website/components/LandingMermaidDemo.vue`, either homepage Markdown file, dependencies, lockfiles, package runtime, navigation, or release files.
- The current workspace contains unrelated user changes, including changes in `website/assets/css/main.css`. Execute in an isolated worktree created through `superpowers:using-git-worktrees`, or stage only the exact task hunks; never commit unrelated changes.
- Track implementation in GitHub Issues through `gh`, following `docs/agents/issue-tracker.md`.

---

## File Structure

- Modify `website/test/landingHero.e2e.test.ts`: lock the approved one-section landing structure and absence of the old English feature copy.
- Modify `website/pages/index.vue`: remove the feature section while preserving the hero.
- Modify `website/i18n/locales/en.json`: remove English feature-only keys.
- Modify `website/i18n/locales/zh.json`: remove Traditional Chinese feature-only keys.
- Modify `website/assets/css/main.css`: remove feature grid/card styles and the mobile override.
- Modify `docs/specs/documentation-website.md`: remove the superseded card contract and card-specific file responsibilities.
- Do not create runtime components, utilities, fixtures, snapshots, or dependencies.

### Task 1: Remove the duplicated homepage feature presentation

**Files:**
- Modify: `website/test/landingHero.e2e.test.ts:25-53`
- Modify: `website/pages/index.vue:31-83`
- Modify: `website/i18n/locales/en.json:19-29`
- Modify: `website/i18n/locales/zh.json:19-29`
- Modify: `website/assets/css/main.css:511-549, 819-822`

**Interfaces:**
- Consumes: the existing `/` landing route, `createLightPage()`, `landing.eyebrow`, `landing.getStarted`, and the `.landing-hero` presentation contract.
- Produces: a landing `<main>` with exactly one direct `<section>`, the existing `.landing-hero`; locale files with only `eyebrow` and `getStarted` under `landing`; no feature-only selectors.

- [ ] **Step 1: Attach execution to a GitHub issue**

Run:

```bash
gh issue list --state open --search '"Remove duplicated homepage feature cards" in:title' --json number,title,url
```

Expected: one matching issue. If the result is `[]`, create it with:

```bash
gh issue create \
  --title "Remove duplicated homepage feature cards" \
  --body $'## Summary\n\nRemove the numbered homepage feature cards so the page ends after the existing hero.\n\n## Contract\n\n- docs/specs/homepage-feature-section-removal.md\n\n## Done when\n\n- The hero is the only landing section.\n- Feature-only markup, translations, and CSS are removed.\n- Website tests, generation, lint, and type checks pass.'
```

Expected: `gh` prints the new issue URL. Record that URL in the execution handoff; do not add a volatile issue number to the durable specification.

- [ ] **Step 2: Write the failing landing-structure test**

Add this test immediately after the first test in `website/test/landingHero.e2e.test.ts`:

```ts
it('ends after the hero without a duplicated feature section', async () => {
  const page = await createLightPage()
  await page.goto(url('/'), { waitUntil: 'hydration' })

  expect(await page.locator('main.landing > section').count()).toBe(1)
  expect(await page.locator('main.landing > .landing-hero').count()).toBe(1)
  expect(await page.getByText('Write diagrams in Markdown').count()).toBe(0)
})
```

- [ ] **Step 3: Run the focused test and confirm the red state**

Run:

```bash
pnpm --dir website exec vitest run test/landingHero.e2e.test.ts -t "ends after the hero without a duplicated feature section"
```

Expected: FAIL because `main.landing > section` has count `2` and the old English feature title is present.

- [ ] **Step 4: Remove the feature markup**

In `website/pages/index.vue`, delete the entire `.feature-grid` section so the template ends like this:

```vue
      <ContentRenderer
        class="landing-demo-content"
        :value="page"
        :data="{ config: null }"
        :components="landingContentComponents"
      />
    </section>
  </main>
</template>
```

Do not change the script or any line inside `.landing-hero`.

- [ ] **Step 5: Remove feature-only locale keys**

Replace the English `landing` object in `website/i18n/locales/en.json` with:

```json
"landing": {
  "eyebrow": "Nuxt Content × Mermaid",
  "getStarted": "Get started"
},
```

Replace the Traditional Chinese `landing` object in `website/i18n/locales/zh.json` with:

```json
"landing": {
  "eyebrow": "Nuxt Content × Mermaid",
  "getStarted": "開始使用"
},
```

- [ ] **Step 6: Remove feature-only CSS**

Delete these complete rule groups from `website/assets/css/main.css`:

```css
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: clamp(5rem, 10vw, 8rem);
}

.feature-card {
  min-width: 0;
  padding: 1.5rem;
  background: color-mix(in srgb, var(--surface-elevated) 75%, transparent);
  border: 1px solid var(--border);
  border-radius: 0.9rem;
}

.feature-card__number {
  color: var(--accent);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.75rem;
  font-weight: 700;
}

.feature-card h2 {
  margin: 1.35rem 0 0.6rem;
  font-size: 1.08rem;
  letter-spacing: -0.015em;
  line-height: 1.3;
}

.feature-card p {
  margin: 0;
  color: var(--muted);
  font-size: 0.94rem;
}

.feature-card code {
  color: var(--text);
  font-size: 0.88em;
}
```

Also delete the complete mobile override inside the existing media query:

```css
.feature-grid {
  grid-template-columns: 1fr;
  margin-top: 4rem;
}
```

Leave adjacent `.landing-demo__panel--source code`, `.docs-grid`, `.landing`, and `.landing-hero` rules byte-for-byte unchanged.

- [ ] **Step 7: Prove no feature implementation remains**

Run:

```bash
if rg -n 'feature-grid|feature-card|"features"|"feature[123](Title|Description)"' website; then
  echo "feature-only homepage implementation remains" >&2
  exit 1
fi
```

Expected: exit code `0` with no matches.

- [ ] **Step 8: Run the focused test and confirm the green state**

Run:

```bash
pnpm --dir website exec vitest run test/landingHero.e2e.test.ts -t "ends after the hero without a duplicated feature section"
```

Expected: PASS; the landing main has one direct section and the former title is absent.

- [ ] **Step 9: Run the complete landing hero test file**

Run:

```bash
pnpm --dir website exec vitest run test/landingHero.e2e.test.ts
```

Expected: all landing hero tests pass, including tab behavior, both themes, 320 px overflow, and Chinese routing.

- [ ] **Step 10: Apply scoped lint fixes before committing**

Run:

```bash
pnpm exec eslint --fix website/test/landingHero.e2e.test.ts website/pages/index.vue
pnpm --dir website exec vitest run test/landingHero.e2e.test.ts
```

Expected: ESLint exits `0` and the complete landing hero test file still passes.

- [ ] **Step 11: Review and commit only the vertical slice**

Run:

```bash
git diff -- website/test/landingHero.e2e.test.ts website/pages/index.vue website/i18n/locales/en.json website/i18n/locales/zh.json website/assets/css/main.css
git status --short
```

Expected: only the test, removed markup, removed locale keys, and removed feature CSS belong to this task. In a dirty workspace, use `git add -p` for `website/assets/css/main.css`; do not stage pre-existing hunks.

Commit:

```bash
git add website/test/landingHero.e2e.test.ts website/pages/index.vue website/i18n/locales/en.json website/i18n/locales/zh.json
git add -p website/assets/css/main.css
git diff --cached --check
git commit -m "refactor(website): remove duplicate homepage features"
```

### Task 2: Reconcile the canonical contract and verify the website

**Files:**
- Modify: `docs/specs/documentation-website.md:277-322, 482-490`
- Reference: `docs/specs/homepage-feature-section-removal.md`

**Interfaces:**
- Consumes: the one-section landing implementation produced by Task 1 and the approved removal specification.
- Produces: one canonical documentation contract with no requirement for feature cards, plus full automated and visual verification evidence.

- [ ] **Step 1: Replace the superseded Vue presentation contract**

In `docs/specs/documentation-website.md`, keep the first three existing responsibility bullets under `### Vue presentation`, delete the card bullet, fixed titles, descriptions table, and card-storage paragraph, then add:

```markdown
- Hero 是首頁唯一的 page-local section；其後不渲染 feature grid、benefit strip、final CTA 或其他填充內容。

首頁可以在 hero 後直接結束。Hero 已負責產品理解、真實 source／rendered proof 與 `Get started` 行動，不以重複文案補足頁面長度。
```

- [ ] **Step 2: Align the visual direction and historical file-scope rows**

Under `### Visual direction`, replace the card-grid bullet with:

```markdown
- Hero 後直接收尾，不加入 feature cards 或補償性留白。
```

In the second-stage file table, change only the two card-specific descriptions to:

```markdown
| `website/pages/index.vue` | 新增 | 查詢首頁 page、404/SEO、hero、CTA 與 `ContentRenderer`。 |
| `website/assets/css/main.css` | 修改 | 加入全站 header、light/dark tokens、landing hero 與 responsive styles；保留 docs styles。 |
```

Do not rewrite unrelated completed phases or the source／preview contract.

- [ ] **Step 3: Check the canonical specs for contradictions and placeholders**

Run:

```bash
if rg -n '三張固定功能卡片|Write diagrams in Markdown|Render interactive diagrams|Keep the source readable|landing hero/cards|三張簡短 cards' docs/specs/documentation-website.md; then
  echo "superseded homepage card contract remains" >&2
  exit 1
fi
rg -n 'Hero 是首頁唯一|Hero 後直接收尾' docs/specs/documentation-website.md
if rg -n '\b(TODO|TBD|FIXME)\b' docs/specs/homepage-feature-section-removal.md docs/specs/documentation-website.md; then
  echo "specification placeholder remains" >&2
  exit 1
fi
```

Expected: the first command exits `0` with no obsolete contract; the second prints both replacement requirements; the placeholder scan prints no matches.

- [ ] **Step 4: Run formatting and static checks**

Run:

```bash
pnpm lint --fix
git diff --check
pnpm test:types
```

Expected: all commands exit `0`, and `pnpm lint --fix` produces no new diff because Task 1 already applied scoped fixes. If it changes a task file, review that exact change and include it with the Task 2 commit; never stage unrelated files.

- [ ] **Step 5: Run website and repository tests**

Run:

```bash
pnpm --dir website test
pnpm test
pnpm --dir website generate
```

Expected: both Vitest suites pass and Nuxt static generation exits `0` with English and Traditional Chinese routes generated.

- [ ] **Step 6: Perform visual verification at the required viewports**

Start the website on a dedicated local port:

```bash
pnpm --dir website dev --host 127.0.0.1 --port 4173
```

Inspect `http://127.0.0.1:4173/` and `http://127.0.0.1:4173/zh` at:

- desktop: `1440 × 900`, light and dark;
- mobile: `320 × 900`, light and dark.

Expected in all four viewport/theme combinations:

- the hero is the only page-local section;
- the page ends naturally after the hero with normal container bottom padding;
- no former feature title or numbered card appears;
- no horizontal overflow appears;
- the Markdown and Rendered UI tabs remain usable;
- the primary CTA remains visible and correctly localized.

Stop the development server after the check. Do not add screenshots or generated output to Git.

- [ ] **Step 7: Commit the integrated contract**

Run:

```bash
git add docs/specs/documentation-website.md website/test/landingHero.e2e.test.ts website/pages/index.vue website/i18n/locales/en.json website/i18n/locales/zh.json
git add -p website/assets/css/main.css
git diff --cached --check
git commit -m "docs(website): align homepage feature contract"
```

Expected: normally only `docs/specs/documentation-website.md` is staged. The implementation paths are listed only to capture reviewed `lint --fix` output if Step 4 changed them; `git diff --cached` must contain no unrelated hunk.

- [ ] **Step 8: Record final evidence and confirm scope**

Run:

```bash
git status --short
git log -2 --oneline
```

Expected: the two implementation commits are visible; the task worktree is clean. If executing in the original dirty workspace, only the pre-existing unrelated changes remain and are explicitly listed in the handoff.

The handoff must report:

- the GitHub issue URL;
- the two implementation commit hashes;
- results for focused E2E, full website tests, root tests, type checks, lint, static generation, and visual verification;
- any pre-existing workspace changes that were intentionally left untouched.
