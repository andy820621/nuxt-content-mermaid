# Website i18n 最小整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 `website/` 的英文與繁體中文文件整合到 `@nuxtjs/i18n`，以 `en` / `zh` 路由、locale-aware Content 查詢、語系切換與固定 UI 翻譯提供可驗證的雙語網站。

**Architecture:** 保留單一 `docs` Content collection，將現有 `content/ch/` 改名為 `content/zh/`，讓內容路徑直接對應 `prefix_except_default` 產生的 `/zh/...` URL。i18n 負責 locale 與 route；Content 仍以 `route.path` 查詢；一個純函式只負責過濾目前語系的 navigation tree。

**Tech Stack:** Nuxt 4.5.2、`@nuxtjs/i18n` 10.6.x、Nuxt Content 3.15.2、Vue 3、TypeScript、Vitest、`@nuxt/test-utils`、Playwright。

## Global Constraints

- 使用 `@nuxtjs/i18n@^10.6.0`，locale 只包含 `en` 與 `zh`。
- 使用 `strategy: 'prefix_except_default'`，`en` 為 default locale，`zh` 使用 `/zh` 前綴。
- `en` 的 HTML language 為 `en-US`，`zh` 的 HTML language 為 `zh-TW`。
- 保留單一 `docs` collection，不建立 `docs_en` / `docs_zh`。
- 第一階段關閉 browser-language auto redirect；URL 是語系來源。
- 不加入新的測試框架；沿用 Vitest、Nuxt Test Utils 與既有 Playwright browser setup。
- 每個行為變更先寫失敗測試並觀察失敗，再加入最小實作。

---

### Task 1: 安裝 i18n 並建立 locale/message 設定

**Files:**
- Modify: `website/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `website/nuxt.config.ts`
- Create: `website/i18n/i18n.config.ts`
- Create: `website/i18n/locales/en.json`
- Create: `website/i18n/locales/zh.json`

**Interfaces:**
- Produces `en` / `zh` locale registration, route strategy, `useI18n()` messages, and generated Nuxt i18n auto-imports.

- [ ] **Step 1: Add the exact dependency through the workspace package manager**

Run:

```bash
pnpm add --filter nuxt-content-mermaid-website @nuxtjs/i18n@^10.6.0
```

Expected: `website/package.json` lists `@nuxtjs/i18n`, and `pnpm-lock.yaml` contains the website importer entry without changing unrelated workspace dependencies.

- [ ] **Step 2: Register typed locales and the minimal route strategy**

Add the type and locale data near the top of `website/nuxt.config.ts`:

```ts
import type { LocaleObject } from '@nuxtjs/i18n'

type SupportedLocale = 'en' | 'zh'

const locales: LocaleObject<SupportedLocale>[] = [
  { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
  { code: 'zh', language: 'zh-TW', name: '繁體中文', file: 'zh.json' },
]
```

Add `@nuxtjs/i18n` to the existing `modules` array and add this config to the object returned by `defineNuxtConfig`:

```ts
  i18n: {
    locales,
    strategy: 'prefix_except_default',
    defaultLocale: 'en',
    detectBrowserLanguage: false,
  },
```

- [ ] **Step 3: Add the message loader and fixed UI messages**

Create `website/i18n/i18n.config.ts`:

```ts
import en from './locales/en.json'
import zh from './locales/zh.json'

export default defineI18nConfig(() => ({
  locale: 'en',
  messages: { en, zh },
}))
```

Create `website/i18n/locales/en.json`:

```json
{
  "site": {
    "name": "Nuxt Content Mermaid",
    "github": "Nuxt Content Mermaid on GitHub",
    "githubTitle": "GitHub repository"
  },
  "navigation": {
    "documentation": "Documentation",
    "troubleshooting": "Troubleshooting"
  },
  "actions": {
    "switchToChinese": "Switch to Chinese",
    "switchToEnglish": "Switch to English",
    "switchToDark": "Switch to dark mode",
    "switchToLight": "Switch to light mode",
    "openMenu": "Open menu",
    "closeMenu": "Close menu"
  },
  "landing": {
    "eyebrow": "Nuxt Content × Mermaid",
    "getStarted": "Get started",
    "features": "Features",
    "feature1Title": "Write diagrams in Markdown",
    "feature1Description": "Use familiar Mermaid fences in Nuxt Content.",
    "feature2Title": "Render interactive diagrams",
    "feature2Description": "Get theme-aware diagrams with built-in controls.",
    "feature3Title": "Keep the source readable",
    "feature3Description": "Preserve readable Markdown when JavaScript is unavailable."
  },
  "demo": {
    "views": "Mermaid demo views",
    "markdown": "Markdown",
    "renderedUi": "Rendered UI"
  },
  "docs": {
    "documentation": "Documentation",
    "onThisPage": "On this page"
  }
}
```

Create `website/i18n/locales/zh.json` with the same keys and these values:

```json
{
  "site": {
    "name": "Nuxt Content Mermaid",
    "github": "Nuxt Content Mermaid GitHub 儲存庫",
    "githubTitle": "GitHub 儲存庫"
  },
  "navigation": {
    "documentation": "文件",
    "troubleshooting": "疑難排解"
  },
  "actions": {
    "switchToChinese": "切換至中文",
    "switchToEnglish": "切換至英文",
    "switchToDark": "切換至深色模式",
    "switchToLight": "切換至淺色模式",
    "openMenu": "開啟選單",
    "closeMenu": "關閉選單"
  },
  "landing": {
    "eyebrow": "Nuxt Content × Mermaid",
    "getStarted": "開始使用",
    "features": "功能",
    "feature1Title": "在 Markdown 中撰寫圖表",
    "feature1Description": "在 Nuxt Content 中使用熟悉的 Mermaid 圍欄。",
    "feature2Title": "渲染互動式圖表",
    "feature2Description": "取得支援主題並內建控制項的圖表。",
    "feature3Title": "保持原始碼可讀",
    "feature3Description": "即使 JavaScript 無法使用，也保留可讀的 Markdown。"
  },
  "demo": {
    "views": "Mermaid 示範檢視",
    "markdown": "Markdown",
    "renderedUi": "渲染介面"
  },
  "docs": {
    "documentation": "文件",
    "onThisPage": "本頁內容"
  }
}
```

- [ ] **Step 4: Regenerate Nuxt types for the configuration-only change**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec nuxt prepare
```

Expected: Nuxt generates i18n imports/types and exits successfully. No application route behavior is asserted in this step.

---

### Task 2: Write the failing navigation-filter test

**Files:**
- Create: `website/test/filterLocaleNavigation.test.ts`

**Interfaces:**
- Consumes: `filterLocaleNavigation(items, locale)` from `website/utils/filterLocaleNavigation.ts`.
- Produces: a focused regression test for locale-specific navigation paths and nested groups.

- [ ] **Step 1: Write the test before creating the utility**

Create `website/test/filterLocaleNavigation.test.ts`:

```ts
import type { ContentNavigationItem } from '@nuxt/content'
import { describe, expect, it } from 'vitest'
import { filterLocaleNavigation } from '~/utils/filterLocaleNavigation'

const navigation = [
  { path: '/', title: 'English home', children: [] },
  { path: '/getting-started', title: 'Getting Started', children: [] },
  {
    path: '/migration',
    title: 'Migration',
    page: false,
    children: [{ path: '/migration/v3', title: 'Migration to v3', children: [] }],
  },
  { path: '/zh', title: '中文首頁', children: [] },
  { path: '/zh/getting-started', title: '開始使用', children: [] },
  {
    path: '/zh/migration',
    title: '中文遷移',
    page: false,
    children: [{ path: '/zh/migration/v3', title: '升級至 v3', children: [] }],
  },
] as unknown as ContentNavigationItem[]

describe('filterLocaleNavigation', () => {
  it('keeps English routes and nested groups for the default locale', () => {
    const result = filterLocaleNavigation(navigation, 'en')

    expect(result.map(item => item.path)).toEqual(['/', '/getting-started', '/migration'])
    expect(result[2]?.children?.map(item => item.path)).toEqual(['/migration/v3'])
  })

  it('keeps Chinese routes and nested groups for the zh locale', () => {
    const result = filterLocaleNavigation(navigation, 'zh')

    expect(result.map(item => item.path)).toEqual(['/zh', '/zh/getting-started', '/zh/migration'])
    expect(result[2]?.children?.map(item => item.path)).toEqual(['/zh/migration/v3'])
  })
})
```

- [ ] **Step 2: Run the focused test and verify the expected RED failure**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run test/filterLocaleNavigation.test.ts
```

Expected: FAIL because `~/utils/filterLocaleNavigation` does not exist yet. A passing result at this point means the test is not exercising the intended new behavior and must be corrected before implementation.

---

### Task 3: Implement and verify the navigation filter

**Files:**
- Create: `website/utils/filterLocaleNavigation.ts`
- Test: `website/test/filterLocaleNavigation.test.ts`

**Interfaces:**
- Consumes: `ContentNavigationItem[]` and `SupportedLocale` (`'en' | 'zh'`).
- Produces: a new navigation tree containing only paths belonging to the requested locale, including groups with matching descendants.

- [ ] **Step 1: Add the minimal pure implementation**

Create `website/utils/filterLocaleNavigation.ts`:

```ts
import type { ContentNavigationItem } from '@nuxt/content'

export type SupportedLocale = 'en' | 'zh'

function belongsToLocale(path: string | undefined, locale: SupportedLocale) {
  if (!path)
    return false

  if (locale === 'en')
    return path === '/' || !path.startsWith('/zh')

  return path === '/zh' || path.startsWith('/zh/')
}

export function filterLocaleNavigation(
  items: ContentNavigationItem[],
  locale: SupportedLocale,
): ContentNavigationItem[] {
  return items.flatMap((item) => {
    const children = filterLocaleNavigation(item.children ?? [], locale)
    const matches = belongsToLocale(item.path, locale)

    if (!matches && children.length === 0)
      return []

    return [{ ...item, children }]
  })
}
```

- [ ] **Step 2: Run the focused test and verify GREEN**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run test/filterLocaleNavigation.test.ts
```

Expected: both locale tests PASS.

- [ ] **Step 3: Run the focused test once after the implementation remains unchanged**

Run the same command again and confirm the output remains green; this guards against accidental dependence on stale Nuxt generated files.

---

### Task 4: Rename the Chinese content tree and its internal links

**Files:**
- Rename: `website/content/ch/` to `website/content/zh/`
- Modify: `website/content/zh/2.getting-started.md`
- Modify: `website/content/zh/4.configuration.md`
- Modify: `website/content/zh/5.troubleshooting.md`

**Interfaces:**
- Consumes: existing Chinese Markdown content.
- Produces: `/zh/...` Content paths that match the i18n route prefix.

- [ ] **Step 1: Move the content directory without changing file contents**

Run:

```bash
git mv website/content/ch website/content/zh
```

Expected: all six existing Chinese Markdown files are now under `website/content/zh/`, with no English content moved.

- [ ] **Step 2: Update all Chinese internal links from `/ch` to `/zh`**

Apply these exact replacements in the moved Markdown files:

```diff
- [撰寫圖表](/ch/writing-diagrams)
+ [撰寫圖表](/zh/writing-diagrams)
+ [設定](/zh/configuration)
+ [疑難排解](/zh/troubleshooting)
+ [升級至 v3](/zh/migration/v3)
+ [開始使用](/zh/getting-started#add-your-first-diagram)
```

Also replace any remaining `/ch/` occurrence under `website/content/zh/`.

- [ ] **Step 3: Verify the rename and link migration**

Run:

```bash
test -d website/content/zh
test ! -d website/content/ch
if rg -n '/ch/' website/content; then exit 1; fi
rtk git diff --check
```

Expected: the `zh` directory exists, `ch` does not, no `/ch/` links remain, and Git reports no whitespace errors.

---

### Task 5: Write failing browser tests for localized routes and language metadata

**Files:**
- Modify: `website/test/landingHero.e2e.test.ts`

**Interfaces:**
- Consumes: the existing `@nuxt/test-utils/e2e` browser setup.
- Produces: browser-level assertions for `/zh`, `/zh/getting-started`, `html[lang]`, and the language switch link.

- [ ] **Step 1: Add a failing Chinese landing-page test**

Append this test to the existing `describe` block:

```ts
it('renders the Chinese landing page with zh-TW metadata and an English switch link', async () => {
  const page = await createPage()
  await page.goto(url('/zh'))

  expect(await page.locator('html').getAttribute('lang')).toBe('zh-TW')
  expect(await page.getByRole('heading', { name: 'Nuxt Content 原生支援 Mermaid 圖表' }).count()).toBe(1)

  const switchLink = page.getByRole('link', { name: '切換至英文' })
  expect(await switchLink.count()).toBe(1)
  expect(await switchLink.getAttribute('href')).toBe('/')
})
```

- [ ] **Step 2: Add a failing Chinese documentation/navigation test**

Append this test:

```ts
it('renders a Chinese documentation route without English navigation entries', async () => {
  const page = await createPage()
  await page.goto(url('/zh/getting-started'))

  expect(await page.getByRole('heading', { name: '開始使用' }).count()).toBeGreaterThan(0)
  expect(await page.getByRole('link', { name: '開始使用' }).count()).toBeGreaterThan(0)
  expect(await page.getByRole('link', { name: 'Getting Started' }).count()).toBe(0)
})
```

- [ ] **Step 3: Run only the changed browser test file and verify RED**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run test/landingHero.e2e.test.ts
```

Expected: the pre-existing English tests continue to run, while the new localized tests fail because the page query, shell links, and language metadata still use the pre-i18n behavior.

---

### Task 6: Implement locale-aware pages, shell, layout, and demo labels

**Files:**
- Modify: `website/app.vue`
- Modify: `website/pages/index.vue`
- Modify: `website/pages/[...slug].vue`
- Modify: `website/layouts/docs.vue`
- Modify: `website/components/LandingMermaidDemo.vue`
- Modify: `website/utils/filterLocaleNavigation.ts`

**Interfaces:**
- Consumes: `@nuxtjs/i18n` composables, `docs` collection paths, and the navigation filter from Task 3.
- Produces: locale-aware links, page queries, navigation, language metadata, and fixed UI messages.

- [ ] **Step 1: Make the landing page query the current locale root**

In `website/pages/index.vue`, add these setup bindings:

```ts
const { locale } = useI18n()
const localePath = useLocalePath()
const landingKey = computed(() => `landing-page:${locale.value}`)

const { data: page } = await useAsyncData(
  landingKey,
  () => queryCollection('docs').path(localePath('/')).first(),
)
```

Replace the hard-coded CTA and feature copy with locale messages:

```vue
<p class="landing-eyebrow">{{ $t('landing.eyebrow') }}</p>
<NuxtLink class="primary-cta" :to="localePath('/getting-started')">
  {{ $t('landing.getStarted') }}
  <span aria-hidden="true">→</span>
</NuxtLink>
<section class="feature-grid" :aria-label="$t('landing.features')">
  <article class="feature-card">
    <span class="feature-card__number">01</span>
    <h2>{{ $t('landing.feature1Title') }}</h2>
    <p>{{ $t('landing.feature1Description') }}</p>
  </article>
  <article class="feature-card">
    <span class="feature-card__number">02</span>
    <h2>{{ $t('landing.feature2Title') }}</h2>
    <p>{{ $t('landing.feature2Description') }}</p>
  </article>
  <article class="feature-card">
    <span class="feature-card__number">03</span>
    <h2>{{ $t('landing.feature3Title') }}</h2>
    <p>{{ $t('landing.feature3Description') }}</p>
  </article>
</section>
```

- [ ] **Step 2: Make the catch-all page query and pass current-locale navigation**

In `website/pages/[...slug].vue`, import the utility and use the locale in the navigation key:

```ts
import type { SupportedLocale } from '~/utils/filterLocaleNavigation'
import { filterLocaleNavigation } from '~/utils/filterLocaleNavigation'

const { locale } = useI18n()

const { data: navigation } = await useAsyncData(
  () => `docs-navigation:${locale.value}`,
  async () => filterLocaleNavigation(
    await queryCollectionNavigation('docs'),
    locale.value as SupportedLocale,
  ),
)
```

Keep the page query as `queryCollection('docs').path(route.path).first()` so the route `/zh/getting-started` resolves the document whose Content path is `/zh/getting-started`.

- [ ] **Step 3: Make the global shell locale-aware**

In `website/app.vue`, add the i18n bindings and filter mobile navigation:

```ts
import type { SupportedLocale } from '~/utils/filterLocaleNavigation'
import { filterLocaleNavigation } from '~/utils/filterLocaleNavigation'

const { locale, localeProperties, t } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()
const nextLocale = computed(() => locale.value === 'en' ? 'zh' : 'en')
const nextLocaleLabel = computed(() => locale.value === 'en'
  ? t('actions.switchToChinese')
  : t('actions.switchToEnglish'))

const localizedNavigation = computed(() => filterLocaleNavigation(
  navigation.value ?? [],
  locale.value as SupportedLocale,
))

const mobileNavigationItems = computed(() => flattenPages(localizedNavigation.value))
```

Change the head and site links:

```ts
useHead(() => ({
  htmlAttrs: {
    lang: localeProperties.value.language,
    'data-theme': activeTheme.value,
  },
}))
```

Replace the existing brand link attribute `to="/"` with `:to="localePath('/')"`. Keep its existing icon and wordmark children unchanged.

```vue
<NuxtLink :to="localePath('/getting-started')">
  {{ $t('navigation.documentation') }}
</NuxtLink>
<NuxtLink :to="localePath('/troubleshooting')">
  {{ $t('navigation.troubleshooting') }}
</NuxtLink>
<NuxtLink
  class="icon-button locale-switch"
  :to="switchLocalePath(nextLocale)"
  :aria-label="nextLocaleLabel"
  :title="nextLocaleLabel"
>
  {{ nextLocale === 'zh' ? '中' : 'EN' }}
</NuxtLink>
```

Replace theme and mobile-menu labels with `$t('actions.*')`, and render `localizedNavigation` rather than the unfiltered navigation ref.

- [ ] **Step 4: Translate docs layout and Mermaid demo fixed labels**

In `website/layouts/docs.vue`, use the existing auto-imported `$t` in the template:

```vue
<nav :aria-label="$t('docs.documentation')">
<nav v-if="tocLinks.length" class="docs-toc" :aria-label="$t('docs.onThisPage')">
  <p>{{ $t('docs.onThisPage') }}</p>
```

Replace the existing `aria-label="Documentation"` and `aria-label="On this page"` attributes with the two bindings above; leave their existing children and navigation links unchanged.

In `website/components/LandingMermaidDemo.vue`, add message keys to the tab records and render them:

```ts
const tabs = [
  { id: 'source', labelKey: 'demo.markdown' },
  { id: 'preview', labelKey: 'demo.renderedUi' },
] as const
```

```vue
<div class="landing-demo__tabs" role="tablist" :aria-label="$t('demo.views')">
</div>
```

In the existing tab button body, replace `{{ tab.label }}` with `{{ $t(tab.labelKey) }}`.

- [ ] **Step 5: Run the focused browser tests and verify GREEN**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run test/landingHero.e2e.test.ts
```

Expected: all existing English landing tests and the two new Chinese route tests PASS.

---

### Task 7: Run the complete verification suite

**Files:**
- Verify: `website/` generated Nuxt output and test artifacts only; do not commit generated `.nuxt` or `.output` files.

**Interfaces:**
- Consumes: the complete implementation from Tasks 1–6.
- Produces: verified Nuxt generated types, passing website tests, type-safe source, and a successful static build.

- [ ] **Step 1: Regenerate Nuxt types**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec nuxt prepare
```

Expected: PASS with i18n-generated imports and route types.

- [ ] **Step 2: Run the website Vitest suite**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run
```

Expected: the navigation unit tests and all landing browser tests PASS.

- [ ] **Step 3: Run website type checking**

Run:

```bash
pnpm exec vue-tsc -p website/tsconfig.json --noEmit
```

Expected: no TypeScript errors in the website, locale config, navigation utility, or tests.

- [ ] **Step 4: Build the static website**

Run:

```bash
pnpm --filter nuxt-content-mermaid-website generate
```

Expected: the static build completes and includes `/index.html`, `/getting-started/index.html`, `/zh/index.html`, and `/zh/getting-started/index.html`.

- [ ] **Step 5: Inspect the final diff and working tree**

Run:

```bash
rtk git diff --check
rtk git status --short
```

Expected: only the intended website source, content, i18n files, tests, `website/package.json`, and `pnpm-lock.yaml` are changed; generated `.nuxt` / `.output` artifacts remain ignored.
