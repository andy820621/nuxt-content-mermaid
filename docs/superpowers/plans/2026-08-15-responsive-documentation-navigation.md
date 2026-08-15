# Responsive Documentation Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wrapped mobile header links and flattened mobile sidebar with one accessible full-screen documentation menu, while making active navigation unmistakable in light and dark themes.

**Architecture:** `website/app.vue` reuses the existing `docs-navigation` async-data key to render one global mobile menu on every route. `website/layouts/docs.vue` keeps the existing desktop sidebar and hides it below `48rem`; both renderers flatten the Nuxt Content navigation locally and share CSS semantics rather than introducing a store, composable, component, utility, or navigation model.

**Tech Stack:** Nuxt 4.5.2, Vue 3.5.41, Nuxt Content 3 APIs, TypeScript, plain CSS.

## Global Constraints

- The authoritative contract is `docs/specs/documentation-website.md` at commit `6f1c7f2`.
- Permanently modify only `website/app.vue`, `website/layouts/docs.vue`, `website/assets/css/main.css`, and `docs/specs/documentation-website.md`.
- Do not modify Content, routes, collection configuration, favicon, social metadata, dependencies, root scripts, CI, artifact, or release files.
- Do not add a component, composable, store, utility, UI framework, search, backdrop, navigation schema, generator, or permanent website test/verifier.
- Preserve `queryCollectionNavigation('docs')`, `queryCollection()`, `ContentRenderer`, and the existing catch-all route/layout data flow.
- The mobile breakpoint remains exactly `48rem`.
- The landing page remains `navigation: false`; the brand link remains the only home entry in the mobile menu context.
- The implementation plan is temporary: commit it before execution, then delete it after all tasks pass so it remains only in Git history.
- Validation is one-time only: structural checks, `pnpm --dir website exec nuxi prepare`, `pnpm --dir website generate`, and manual browser checks. Do not commit validation output.

---

### Task 1: Add the global mobile documentation menu

**Files:**
- Modify: `website/app.vue:1-133`
- Modify: `website/assets/css/main.css:85-175,439-521`

**Interfaces:**
- Consumes: Nuxt Content `ContentNavigationItem[]`, the existing `docs-navigation` `useAsyncData` key, `route.fullPath`, and the existing `48rem` breakpoint.
- Produces: `mobileMenuOpen: Ref<boolean>`, `mobileNavigationItems: ComputedRef<ContentNavigationItem[]>`, `closeMobileMenu(restoreFocus?: boolean): Promise<void>`, and DOM ids `mobile-documentation-menu` / `mobile-menu-button`.

- [ ] **Step 1: Run a one-time RED structural check**

Run:

```bash
node - <<'NODE'
const fs = require('node:fs')
const app = fs.readFileSync('website/app.vue', 'utf8')
const css = fs.readFileSync('website/assets/css/main.css', 'utf8')

const implemented = [
  app.includes("queryCollectionNavigation('docs')"),
  app.includes('mobileMenuOpen'),
  app.includes('aria-controls="mobile-documentation-menu"'),
  app.includes(':inert="mobileMenuOpen"'),
  css.includes('.mobile-menu-toggle'),
  css.includes('.mobile-documentation-menu'),
].every(Boolean)

if (!implemented) {
  throw new Error('responsive documentation menu is not implemented')
}
NODE
```

Expected: FAIL with `responsive documentation menu is not implemented`.

- [ ] **Step 2: Add navigation data and the single menu state to `app.vue`**

Add the type import and state near the beginning of `<script setup>`:

```ts
import type { ContentNavigationItem } from '@nuxt/content'

const mobileMenuButton = useTemplateRef<HTMLButtonElement>('mobileMenuButton')
const mobileMenuOpen = ref(false)

const { data: navigation } = await useAsyncData('docs-navigation', () => {
  return queryCollectionNavigation('docs')
})

function flattenPages(items: ContentNavigationItem[]): ContentNavigationItem[] {
  return items.flatMap(item => [
    ...(item.page === false ? [] : [item]),
    ...flattenPages(item.children ?? []),
  ])
}

const mobileNavigationItems = computed(() => flattenPages(navigation.value ?? []))
```

Keep the existing theme state and metadata unchanged.

- [ ] **Step 3: Add close, Escape, route-change, and breakpoint behavior**

Add these functions and lifecycle hooks after `toggleTheme()`:

```ts
let mobileViewport: MediaQueryList | undefined

async function closeMobileMenu(restoreFocus = false) {
  if (!mobileMenuOpen.value)
    return

  mobileMenuOpen.value = false

  if (restoreFocus) {
    await nextTick()
    mobileMenuButton.value?.focus()
  }
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && mobileMenuOpen.value)
    void closeMobileMenu(true)
}

function handleViewportChange(event: MediaQueryListEvent) {
  if (!event.matches)
    void closeMobileMenu()
}

watch(() => route.fullPath, () => {
  void closeMobileMenu()
})

onMounted(() => {
  mobileViewport = window.matchMedia('(max-width: 48rem)')
  mobileViewport.addEventListener('change', handleViewportChange)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  mobileViewport?.removeEventListener('change', handleViewportChange)
  window.removeEventListener('keydown', handleGlobalKeydown)
})
```

Extend the existing reactive `useHead()` return without changing its current `htmlAttrs` or favicon links:

```ts
bodyAttrs: {
  class: mobileMenuOpen.value ? 'mobile-menu-open' : undefined,
},
```

- [ ] **Step 4: Add the hamburger, menu, and inert page wrapper**

Append the hamburger after the GitHub link inside `.site-actions`:

```vue
<button
  id="mobile-menu-button"
  ref="mobileMenuButton"
  class="icon-button mobile-menu-toggle"
  type="button"
  :aria-label="mobileMenuOpen ? 'Close menu' : 'Open menu'"
  :title="mobileMenuOpen ? 'Close menu' : 'Open menu'"
  :aria-expanded="mobileMenuOpen"
  aria-controls="mobile-documentation-menu"
  @click="toggleMobileMenu"
>
  <svg
    v-if="mobileMenuOpen"
    aria-hidden="true"
    viewBox="0 0 24 24"
  >
    <path d="M6 6 18 18M18 6 6 18" />
  </svg>
  <svg
    v-else
    aria-hidden="true"
    viewBox="0 0 24 24"
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
</button>
```

Render this sibling immediately after `</header>`:

```vue
<div
  v-if="mobileMenuOpen"
  id="mobile-documentation-menu"
  class="mobile-documentation-menu"
>
  <nav
    class="mobile-documentation-menu__inner"
    aria-label="Documentation"
  >
    <p>Documentation</p>
    <NuxtLink
      v-for="item in mobileNavigationItems"
      :key="item.path"
      class="mobile-navigation-link"
      :to="item.path"
      :aria-current="item.path === route.path ? 'page' : undefined"
      @click="closeMobileMenu()"
    >
      {{ item.title }}
    </NuxtLink>
  </nav>
</div>
```

Replace the bare `NuxtPage` with the inert wrapper:

```vue
<div
  class="site-page"
  :inert="mobileMenuOpen"
  :aria-hidden="mobileMenuOpen ? 'true' : undefined"
>
  <NuxtPage />
</div>
```

- [ ] **Step 5: Add the mobile panel and one-row header CSS**

Add desktop defaults near the header rules:

```css
.mobile-menu-toggle,
.mobile-documentation-menu {
  display: none;
}
```

Replace the current mobile grid/second-row navigation rules inside `@media (max-width: 48rem)` with:

```css
body.mobile-menu-open {
  overflow: hidden;
}

.site-header__inner {
  gap: 0.5rem;
  width: min(100% - 1.25rem, 48rem);
  min-height: 4rem;
  padding: 0;
}

.site-brand {
  min-width: 0;
}

.site-nav {
  display: none;
}

.site-actions {
  margin-left: auto;
}

.mobile-menu-toggle {
  display: inline-grid;
}

.mobile-documentation-menu {
  position: fixed;
  z-index: 9;
  inset: 4rem 0 0;
  display: block;
  overflow-y: auto;
  color: var(--text);
  background: var(--background);
  border-top: 1px solid var(--border);
}

.mobile-documentation-menu__inner {
  display: grid;
  gap: 0.25rem;
  width: min(100% - 2rem, 40rem);
  margin: 0 auto;
  padding: 1.5rem 0 3rem;
}

.mobile-documentation-menu__inner p {
  margin: 0 0 0.75rem;
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mobile-navigation-link {
  display: block;
  padding: 0.65rem 0.75rem;
  color: var(--muted);
  text-decoration: none;
}
```

Remove the obsolete `.site-nav` rules from `@media (max-width: 25rem)`. Preserve the existing wordmark sizing rule.

- [ ] **Step 6: Run the one-time GREEN structural and Nuxt preparation checks**

Run the Step 1 Node command again.

Expected: PASS with exit code 0.

Run:

```bash
pnpm --dir website exec nuxi prepare
git diff --check
```

Expected: Nuxt types are generated and `git diff --check` prints nothing.

- [ ] **Step 7: Commit the functional mobile menu**

```bash
git add website/app.vue website/assets/css/main.css
git commit -m "feat(website): add responsive documentation menu"
```

---

### Task 2: Strengthen navigation active states and remove the mobile sidebar

**Files:**
- Modify: `website/layouts/docs.vue:19-30`
- Modify: `website/assets/css/main.css:333-353,430-502`

**Interfaces:**
- Consumes: `.mobile-navigation-link`, `aria-current="page"`, existing light/dark CSS tokens, and the layout's existing `sidebarItems` computed value.
- Produces: `.docs-navigation-link` with the same active/hover/focus visual contract as `.mobile-navigation-link`; `.docs-sidebar` is desktop-only below `48rem`.

- [ ] **Step 1: Run a one-time RED style check**

Run:

```bash
node - <<'NODE'
const fs = require('node:fs')
const layout = fs.readFileSync('website/layouts/docs.vue', 'utf8')
const css = fs.readFileSync('website/assets/css/main.css', 'utf8')

const implemented = [
  layout.includes('class="docs-navigation-link"'),
  css.includes('border-left: 2px solid transparent'),
  css.includes('border-left-color: var(--accent)'),
  css.includes('background: var(--accent-soft)'),
  /@media \(max-width: 48rem\)[\s\S]*?\.docs-sidebar \{[\s\S]*?display: none;/.test(css),
].every(Boolean)

if (!implemented) {
  throw new Error('active navigation and mobile sidebar styles are not implemented')
}
NODE
```

Expected: FAIL with `active navigation and mobile sidebar styles are not implemented`.

- [ ] **Step 2: Give desktop sidebar links a shared semantic class**

Update the existing layout link without changing its key, destination, title, or `aria-current` behavior:

```vue
<NuxtLink
  v-for="item in sidebarItems"
  :key="item.path"
  class="docs-navigation-link"
  :to="item.path"
  :aria-current="item.path === page.path ? 'page' : undefined"
>
  {{ item.title }}
</NuxtLink>
```

- [ ] **Step 3: Replace the low-contrast sidebar state with shared styles**

Replace `.docs-sidebar a`, its hover rule, and its active rule with:

```css
.docs-navigation-link,
.mobile-navigation-link {
  display: block;
  padding: 0.55rem 0.75rem;
  color: var(--muted);
  background: transparent;
  border-left: 2px solid transparent;
  border-radius: 0 0.4rem 0.4rem 0;
  text-decoration: none;
}

.docs-navigation-link:hover,
.mobile-navigation-link:hover {
  color: var(--text);
  background: var(--surface);
}

.docs-navigation-link[aria-current='page'],
.mobile-navigation-link[aria-current='page'] {
  color: var(--accent);
  background: var(--accent-soft);
  border-left-color: var(--accent);
  font-weight: 700;
}

.docs-navigation-link:focus-visible,
.mobile-navigation-link:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
```

Remove the duplicate base declarations for `.mobile-navigation-link` added in Task 1, leaving only this shared rule.

- [ ] **Step 4: Hide the layout sidebar entirely on mobile**

Replace the mobile `.docs-sidebar` and `.docs-sidebar nav` blocks with:

```css
.docs-sidebar {
  display: none;
}
```

Keep `.docs-grid { grid-template-columns: 1fr; }`, the mobile width, and the existing right-TOC behavior unchanged.

- [ ] **Step 5: Run the GREEN style and preparation checks**

Run the Step 1 Node command again.

Expected: PASS with exit code 0.

Run:

```bash
pnpm --dir website exec nuxi prepare
git diff --check
```

Expected: Nuxt preparation succeeds and `git diff --check` prints nothing.

- [ ] **Step 6: Commit the sidebar and active-state refinement**

```bash
git add website/layouts/docs.vue website/assets/css/main.css
git commit -m "style(website): clarify documentation navigation state"
```

---

### Task 3: Verify the complete interaction and close the design stage

**Files:**
- Modify: `docs/specs/documentation-website.md:6-12`
- Delete after all checks pass: `docs/superpowers/plans/2026-08-15-responsive-documentation-navigation.md`

**Interfaces:**
- Consumes: the complete Task 1/2 UI, the fixed origin and metadata already in the website, and the formal acceptance criteria 8, 10, 12, and 17-20.
- Produces: a generated static website, recorded completed status in the canonical specification, clean worktree, and no permanent test artifact.

- [ ] **Step 1: Generate the complete static website**

Run:

```bash
pnpm --dir website generate
```

Expected:

- Exit code 0.
- Existing routes `/`, `/getting-started`, `/writing-diagrams`, `/configuration`, `/troubleshooting`, and `/migration/v3` are prerendered.
- Existing chunk-size and upstream H3 unused-import warnings may remain; no new error is accepted.

- [ ] **Step 2: Check the generated routes and permanent boundaries**

Run:

```bash
node - <<'NODE'
const fs = require('node:fs')

const routes = [
  'index.html',
  'getting-started/index.html',
  'writing-diagrams/index.html',
  'configuration/index.html',
  'troubleshooting/index.html',
  'migration/v3/index.html',
]

const checks = {
  allRoutesGenerated: routes.every(route => fs.existsSync(`website/.output/public/${route}`)),
  noWebsiteTests: !fs.existsSync('website/test') && !fs.existsSync('website/tests'),
  noNavigationUtility: !fs.existsSync('website/utils'),
  noNavigationComponent: !fs.existsSync('website/components'),
}

console.log(JSON.stringify(checks, null, 2))
if (Object.values(checks).some(value => !value))
  process.exit(1)
NODE
```

Expected: every value is `true`.

- [ ] **Step 3: Perform desktop browser checks in light and dark themes**

Start the local server:

```bash
pnpm --dir website dev --host 127.0.0.1 --port 3000
```

At `1440 × 1000`, check `/getting-started` in both themes:

- `Documentation` and `Troubleshooting` are visible in the Header.
- Hamburger and mobile menu are hidden.
- Desktop sidebar and right TOC are visible.
- Getting Started has `aria-current="page"`, accent text, accent left border, soft background, and a visible focus outline.
- Theme toggle and GitHub link work.
- No horizontal overflow or browser error is present.

- [ ] **Step 4: Perform mobile browser checks in light and dark themes**

At `390 × 844`, check `/` and `/getting-started` in both themes:

- Header is one row; wordmark, theme, GitHub, and hamburger remain visible.
- Desktop text navigation and `.docs-sidebar` are hidden.
- Opening the hamburger shows exactly five links: Getting Started, Writing Diagrams, Configuration, Troubleshooting, and Migration to v3.
- The menu occupies the viewport below the `4rem` Header and scrolls independently.
- Open state sets `aria-expanded="true"`, changes the label to `Close menu`, locks body scrolling, and makes `.site-page` inert.
- Theme and GitHub remain operable while the menu is open.
- The current route uses the same accent line/text/soft-background active style as desktop.
- Escape closes the menu and returns focus to `#mobile-menu-button`.
- Reopening and clicking `/troubleshooting` navigates and closes the menu.
- Resizing above `48rem` closes the menu and restores an interactive page.
- No horizontal overflow or browser error is present.

Stop the local server after the checks.

- [ ] **Step 5: Mark the formal specification complete**

In `docs/specs/documentation-website.md`, replace:

```md
- 2026-08-15：核准第五階段 responsive navigation 優化；本次規格已完成，程式尚未實作。
```

with:

```md
- 2026-08-15：完成第五階段 responsive navigation 優化，以單一手機文件選單與高辨識 active state 改善導覽。
```

Do not change any architecture, scope, or acceptance criterion.

- [ ] **Step 6: Remove the completed temporary plan**

Use `apply_patch` to delete:

```text
docs/superpowers/plans/2026-08-15-responsive-documentation-navigation.md
```

Do not delete the formal specification or research records.

- [ ] **Step 7: Run the final checks and commit the completion record**

Run:

```bash
git diff --check
git status --short
```

Expected: only the specification status change and plan deletion are pending.

Commit:

```bash
git add docs/specs/documentation-website.md docs/superpowers/plans/2026-08-15-responsive-documentation-navigation.md
git commit -m "docs: complete responsive navigation rollout"
```

Run:

```bash
git status --short
git log -4 --oneline
```

Expected: clean worktree and the plan/design/implementation commits at `HEAD`.

