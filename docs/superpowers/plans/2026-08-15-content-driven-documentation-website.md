# Content-Driven Documentation Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將網站改造成六個手寫 Markdown 文件、單一 Nuxt Content 3 catch-all page 與通用 docs layout，並讓網站完全退出套件的 root、CI、artifact 與 release 流程。

**Architecture:** `docs` page collection 直接讀取 Markdown；`pages/[...slug].vue` 使用 `queryCollection()` 與 `queryCollectionNavigation()` 取得 page/navigation，再把資料交給 `layouts/docs.vue`。Layout 以官方 navigation tree、`ContentRenderer` 與 page body TOC 組成左／中／右三欄，不存在 records、生成器或永久驗證層。

**Tech Stack:** Nuxt 4、Nuxt Content 3.15.2、Vue 3、`@barzhsieh/nuxt-content-mermaid`、plain CSS、pnpm workspace。

## Global Constraints

- 正式契約是 `docs/specs/documentation-website.md`；若本計畫與規格衝突，以規格為準並停止實作釐清。
- 只使用 Nuxt Content 3 的 `queryCollection()`、`queryCollectionNavigation()` 與 `ContentRenderer`；不得加入 Content 2 API。
- 網站只有一個 `docs` page collection；不得新增 data collection、自訂 content schema 或 option inventory。
- 初始公開內容固定為 Overview、Getting Started、Writing Diagrams、Configuration、Troubleshooting、Migration to v3 六頁。
- 不保留 `/reference` redirect。
- 不引入 Nuxt UI Pro、Nuxt Studio、搜尋、analytics、OG Image、認證、部署或發佈策略。
- 不新增網站 lint/test/typecheck/build gate；網站沒有專用 tests 或 verifier scripts。
- Root lint/test/typecheck/build、CI、artifact 與 release 不得讀取或驗證 `website/**`。
- `website` 可以留在 pnpm workspace，並以 `workspace:*` 解析本機套件；這不形成 package quality/release contract。
- 實作時可以一次性執行 `pnpm --dir website generate` 供 AI agent 檢查，但不得把它接到 root scripts 或 workflow。
- 所有檔案修改使用 `apply_patch`；不得用 shell 寫檔或破壞使用者既有變更。

---

## 最終檔案地圖

### 建立

- `website/layouts/docs.vue`：通用 docs shell、sidebar 與 TOC。
- `website/pages/[...slug].vue`：唯一內容 route。
- `website/content/1.index.md`：Overview。
- `website/content/2.getting-started.md`：Getting Started。
- `website/content/3.writing-diagrams.md`：Writing Diagrams。
- `website/content/4.configuration.md`：Configuration。
- `website/content/5.troubleshooting.md`：Troubleshooting。
- `website/content/6.migration/1.v3.md`：Migration to v3。

### 修改

- `docs/specs/documentation-website.md`：已核准的正式契約。
- `.github/workflows/ci.yml`：移除網站驗證 step。
- `eslint.config.mjs`：全域忽略 `website/**`。
- `vitest.config.ts`：排除 `website/**`。
- `package.json`：移除四個 root website scripts。
- `pnpm-lock.yaml`：反映網站 workspace dependency 與依賴清理。
- `test/releaseVerificationOperations.test.ts`：移除 website/Contract Demo artifact path 範例。
- `website/assets/css/main.css`：改成最小 docs layout CSS。
- `website/content.config.ts`：改成唯一 `docs` page collection。
- `website/nuxt.config.ts`：只註冊 Content、本套件與 CSS。
- `website/package.json`：只保留本機 `dev`/`generate` 與必要依賴。

### 刪除

- `assets/contract-demo/basic.mmd`
- `scripts/website/` 全目錄
- `website/components/` 全目錄
- `website/reference/` 全目錄
- `website/utils/` 全目錄
- 五個既有個別 page wrappers
- 五個未編號的既有 Markdown paths（內容搬到新路徑後刪除）
- 十個 website/CI 驗證 tests
- `docs/superpowers/plans/2026-08-14-documentation-candidate-shell-spike.md`
- `docs/spikes/documentation-candidate-shell-result.md`

---

### Task 1: 保存核准的設計基線

**Files:**

- Modify: `docs/specs/documentation-website.md`
- Create: `docs/research/documentation-site-architecture-comparison.md`
- Create: `docs/superpowers/plans/2026-08-15-content-driven-documentation-website.md`

**Interfaces:**

- Consumes: 使用者核准的 A 方案、Nuxt Content 3 API 決策與完整退出品質／交付流程的邊界。
- Produces: 後續 tasks 唯一可依循的正式規格與逐步計畫。

- [ ] **Step 1: 確認設計文件 diff 只包含研究、規格與計畫**

Run:

```bash
rtk git diff -- docs/specs/documentation-website.md docs/research/documentation-site-architecture-comparison.md docs/superpowers/plans/2026-08-15-content-driven-documentation-website.md
rtk git status --short
```

Expected: 尚未出現網站 runtime、CI、scripts 或 tests 的實作變更。

- [ ] **Step 2: 提交設計基線**

```bash
git add docs/specs/documentation-website.md docs/research/documentation-site-architecture-comparison.md docs/superpowers/plans/2026-08-15-content-driven-documentation-website.md
git commit -m "docs: simplify documentation website architecture"
```

---

### Task 2: 讓網站退出 root、CI、artifact 與 release 驗證

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `eslint.config.mjs`
- Modify: `vitest.config.ts`
- Modify: `test/releaseVerificationOperations.test.ts`
- Delete: `test/ciWorkflow.test.ts`
- Delete: `test/websiteArtifact.test.ts`
- Delete: `test/websiteBoundary.test.ts`
- Delete: `test/websiteReferenceCorpus.test.ts`
- Delete: `test/websiteReferenceParity.test.ts`
- Delete: `test/websiteReferencePublic.test.ts`
- Delete: `test/websiteReferenceRender.test.ts`
- Delete: `test/websiteReferenceVerifier.test.ts`
- Delete: `test/websiteStaticSite.test.ts`
- Delete: `test/websiteVerification.test.ts`

**Interfaces:**

- Consumes: 現有 root `verify:source` 與 package release verification。
- Produces: root checks 明確排除網站；後續網站重構不會造成 package CI failure。

- [ ] **Step 1: 移除 root website scripts**

從 root `package.json` 的 `scripts` 刪除以下四個 keys，其他 package scripts 保持不變：

```json
{
  "test:website-static": "node scripts/website/static-site.mjs",
  "verify:website": "node scripts/website/verify.mjs",
  "verify:website-artifact": "node scripts/website/artifact.mjs",
  "verify:website-reference": "node scripts/website/reference-verifier.mjs"
}
```

- [ ] **Step 2: 移除 CI 的網站 step**

從 `.github/workflows/ci.yml` 的 `source-verification.steps` 完整刪除：

```yaml
- name: Verify documentation website
  run: pnpm verify:website
```

保留 package tests 仍需要的 Playwright browser 安裝與 `pnpm verify:source`。

- [ ] **Step 3: 讓 root ESLint 全域忽略網站**

將 `eslint.config.mjs` 的 composer 改成在既有 rules 前加入一個只有 ignores 的 global config：

```js
export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: true,
  },
  dirs: {
    src: ['./playground'],
  },
}).prepend({
  name: 'project/ignore-documentation-website',
  ignores: ['website/**'],
}).append({
  rules: {
    'vue/multi-word-component-names': 'off',
  },
})
```

- [ ] **Step 4: 讓 root Vitest 排除網站**

在 `vitest.config.ts` 的既有 `test.exclude` 加入：

```ts
'website/**',
```

`tsconfig.json` 已經排除 `website`，不要新增另一份 typecheck config。

- [ ] **Step 5: 刪除所有網站與 CI ownership tests**

使用 `apply_patch` 刪除本 Task `Files` 區段列出的十個 tests。不要新增「確認網站未進 CI」的替代 test；ESLint/Vitest/TypeScript exclusions 與 workflow 本身就是邊界。

- [ ] **Step 6: 從 package artifact test 移除網站語意**

在 `test/releaseVerificationOperations.test.ts` 將 unexpected-path table 改為一般非 package paths：

```ts
it.each([
  'playground/app.vue',
  'docs/internal-notes.md',
  '.output/public/index.html',
  'debug/request-log.json',
])('rejects non-package surface in the publishable artifact: %s', async (unexpectedPath) => {
```

只保留 package allowlist 行為；release test 不再提到 website 或 Contract Demo。

- [ ] **Step 7: 確認 root 與 release 已沒有網站入口**

Run:

```bash
rtk rg -n 'verify:website|test:website-static|scripts/website' package.json .github/workflows test
rtk rg -n '\bwebsite\b|ContractDemo' scripts/release-verification .github/workflows/publish.yml test/releaseVerificationOperations.test.ts
```

Expected: 兩個查詢都沒有輸出。

- [ ] **Step 8: 執行 package-only checks**

Run:

```bash
pnpm lint
pnpm test
pnpm test:types
```

Expected: 全部 exit 0；輸出不包含 website lint、website tests 或 website typecheck。

- [ ] **Step 9: 提交品質邊界變更**

```bash
git add package.json .github/workflows/ci.yml eslint.config.mjs vitest.config.ts test/releaseVerificationOperations.test.ts
git add -u -- test/ciWorkflow.test.ts test/websiteArtifact.test.ts test/websiteBoundary.test.ts test/websiteReferenceCorpus.test.ts test/websiteReferenceParity.test.ts test/websiteReferencePublic.test.ts test/websiteReferenceRender.test.ts test/websiteReferenceVerifier.test.ts test/websiteStaticSite.test.ts test/websiteVerification.test.ts
git commit -m "chore: decouple website from package verification"
```

---

### Task 3: 建立單一 Nuxt Content 3 route 與通用 docs layout

**Files:**

- Modify: `website/content.config.ts`
- Modify: `website/nuxt.config.ts`
- Modify: `website/package.json`
- Modify: `website/assets/css/main.css`
- Modify: `pnpm-lock.yaml`
- Create: `website/pages/[...slug].vue`
- Create: `website/layouts/docs.vue`
- Delete: `assets/contract-demo/basic.mmd`
- Delete: `website/components/ContractDemo.vue`
- Delete: `website/components/PageShell.vue`
- Delete: `website/pages/index.vue`
- Delete: `website/pages/getting-started.vue`
- Delete: `website/pages/troubleshooting.vue`
- Delete: `website/pages/migration/v3.vue`
- Delete: `website/pages/reference.vue`

**Interfaces:**

- Consumes: Nuxt Content 3 `PageCollections['docs']`、`ContentNavigationItem[]` 與 page body TOC。
- Produces: 所有 Markdown routes 共用的單一 query/rendering path；Task 4 只需搬移與改寫 Markdown。

- [ ] **Step 1: 將 content config 收斂成一個內建 page collection**

以以下完整內容取代 `website/content.config.ts`：

```ts
import { defineCollection, defineContentConfig } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: '**',
    }),
  },
})
```

這會移除 `pageId` 與自訂 Zod schema，並讓標準 `.navigation.yml` 在未來需要時可被 collection 讀取。

- [ ] **Step 2: 簡化 Nuxt config**

以以下完整內容取代 `website/nuxt.config.ts`：

```ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
  ],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-11-24',
})
```

不得保留 `@nuxt/kit`、`addTemplate`、`website-reference-model`、hard-coded prerender routes 或 Reference loader import。

- [ ] **Step 3: 將網站 manifest 改成本機內容應用程式**

以以下內容取代 `website/package.json`：

```json
{
  "name": "nuxt-content-mermaid-website",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "nuxt dev",
    "generate": "nuxt generate"
  },
  "dependencies": {
    "@barzhsieh/nuxt-content-mermaid": "workspace:*",
    "@nuxt/content": "catalog:integrations",
    "better-sqlite3": "12.5.0",
    "nuxt": "catalog:dev"
  }
}
```

不要保留 `typecheck`、`vue-tsc` 或網站 verifier scripts。

- [ ] **Step 4: 建立唯一 catch-all page**

建立 `website/pages/[...slug].vue`：

```vue
<script setup lang="ts">
definePageMeta({
  layout: false,
  key: route => route.path,
})

const route = useRoute()

const { data: page } = await useAsyncData(`docs-page:${route.path}`, () => {
  return queryCollection('docs').path(route.path).first()
})

const { data: navigation } = await useAsyncData('docs-navigation', () => {
  return queryCollectionNavigation('docs')
})

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Documentation page not found',
  })
}

useSeoMeta({
  title: page.value.title,
  description: page.value.description,
})
</script>

<template>
  <NuxtLayout
    v-if="page"
    name="docs"
    :page="page"
    :navigation="navigation ?? []"
  >
    <ContentRenderer :value="page" />
  </NuxtLayout>
</template>
```

這是唯一呼叫 `queryCollection()`、`queryCollectionNavigation()` 與 `ContentRenderer` 的內容 route。

- [ ] **Step 5: 建立通用 docs layout**

建立 `website/layouts/docs.vue`：

```vue
<script setup lang="ts">
import type { ContentNavigationItem, PageCollections } from '@nuxt/content'

const props = defineProps<{
  page: PageCollections['docs']
  navigation: ContentNavigationItem[]
}>()

function flattenPages(items: ContentNavigationItem[]): ContentNavigationItem[] {
  return items.flatMap(item => [
    ...(item.page === false ? [] : [item]),
    ...flattenPages(item.children ?? []),
  ])
}

const sidebarItems = computed(() => flattenPages(props.navigation))
const tocLinks = computed(() => props.page.body.toc?.links ?? [])
</script>

<template>
  <div class="docs-shell">
    <a
      class="skip-link"
      href="#main-content"
    >Skip to content</a>

    <header class="docs-header">
      <NuxtLink
        class="docs-brand"
        to="/"
      >Nuxt Content Mermaid</NuxtLink>
    </header>

    <div class="docs-grid">
      <aside class="docs-sidebar">
        <nav aria-label="Documentation">
          <NuxtLink
            v-for="item in sidebarItems"
            :key="item.path"
            :to="item.path"
            :aria-current="item.path === page.path ? 'page' : undefined"
          >
            {{ item.title }}
          </NuxtLink>
        </nav>
      </aside>

      <main
        id="main-content"
        class="docs-content"
        tabindex="-1"
      >
        <article>
          <slot />
        </article>
      </main>

      <aside
        v-if="tocLinks.length"
        class="docs-toc"
      >
        <nav aria-label="On this page">
          <p>On this page</p>
          <ul>
            <li
              v-for="link in tocLinks"
              :key="link.id"
            >
              <a :href="`#${link.id}`">{{ link.text }}</a>
              <ul v-if="link.children?.length">
                <li
                  v-for="child in link.children"
                  :key="child.id"
                >
                  <a :href="`#${child.id}`">{{ child.text }}</a>
                </li>
              </ul>
            </li>
          </ul>
        </nav>
      </aside>
    </div>
  </div>
</template>
```

`flattenPages()` 只把 Content navigation tree 轉成當次 render 的 leaf links，不儲存資料，也不形成第二份 navigation model。

- [ ] **Step 6: 將 CSS 收斂成閱讀版面**

以以下結構重寫 `website/assets/css/main.css`；保留 selector 與 responsive 行為，不搬回 home/reference/demo styles：

```css
:root {
  color-scheme: light dark;
  --background: #ffffff;
  --surface: #f6f7f9;
  --text: #1f2933;
  --muted: #667085;
  --border: #dfe3e8;
  --accent: #087f5b;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #111714;
    --surface: #19211d;
    --text: #eef5f1;
    --muted: #aab8b0;
    --border: #34443c;
    --accent: #69dbb5;
  }
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  color: var(--text);
  background: var(--background);
  line-height: 1.65;
}

a {
  color: var(--accent);
}

.skip-link {
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 10;
  padding: 0.6rem 0.8rem;
  color: var(--background);
  background: var(--text);
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: translateY(0);
}

.docs-header {
  position: sticky;
  top: 0;
  z-index: 5;
  padding: 1rem max(1.25rem, calc((100vw - 80rem) / 2));
  background: var(--background);
  border-bottom: 1px solid var(--border);
}

.docs-brand {
  color: var(--text);
  font-weight: 700;
  text-decoration: none;
}

.docs-grid {
  display: grid;
  grid-template-columns: minmax(11rem, 15rem) minmax(0, 48rem) minmax(10rem, 14rem);
  gap: 2rem;
  width: min(80rem, calc(100% - 2.5rem));
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.docs-sidebar,
.docs-toc {
  position: sticky;
  top: 5rem;
  align-self: start;
  max-height: calc(100vh - 6rem);
  overflow: auto;
}

.docs-sidebar nav {
  display: grid;
  gap: 0.25rem;
}

.docs-sidebar a {
  padding: 0.5rem 0.65rem;
  color: var(--muted);
  border-radius: 0.4rem;
  text-decoration: none;
}

.docs-sidebar a[aria-current='page'] {
  color: var(--text);
  background: var(--surface);
  font-weight: 650;
}

.docs-content {
  min-width: 0;
}

.docs-content article > :first-child {
  margin-top: 0;
}

.docs-content h1,
.docs-content h2,
.docs-content h3 {
  line-height: 1.25;
  scroll-margin-top: 5rem;
}

.docs-content h2 {
  margin-top: 2.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.docs-content pre {
  overflow: auto;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}

.docs-content table {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

.docs-content th,
.docs-content td {
  padding: 0.65rem;
  border: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.docs-toc p {
  margin-top: 0;
  font-weight: 650;
}

.docs-toc ul {
  margin: 0;
  padding-left: 1rem;
}

.docs-toc a {
  color: var(--muted);
  font-size: 0.875rem;
  text-decoration: none;
}

:where(a, button):focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

@media (max-width: 62rem) {
  .docs-grid {
    grid-template-columns: minmax(10rem, 13rem) minmax(0, 1fr);
  }

  .docs-toc {
    display: none;
  }
}

@media (max-width: 44rem) {
  .docs-grid {
    grid-template-columns: 1fr;
    width: min(100% - 2rem, 48rem);
    padding-top: 1rem;
  }

  .docs-sidebar {
    position: static;
    max-height: none;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .docs-sidebar nav {
    display: flex;
    flex-wrap: wrap;
  }
}
```

- [ ] **Step 7: 刪除個別 pages、舊 shell 與 Contract Demo**

使用 `apply_patch` 刪除本 Task `Files` 區段列出的七個 Vue files 與 `assets/contract-demo/basic.mmd`。暫時保留 Reference record components、records 與 scripts 到 Task 4，讓內容遷移可逐項核對。

- [ ] **Step 8: 更新 workspace lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: website importer 使用 `workspace:*` 連到 root package；`typescript` 與 `vue-tsc` 不再是 website importer 的直接 dev dependencies。

- [ ] **Step 9: 一次性檢查通用 route/layout**

Run:

```bash
pnpm dev:prepare
pnpm --dir website generate
```

Expected: command exit 0；現有 Markdown 可透過 catch-all page 產生。這是實作期檢查，不接到 root scripts 或 CI。

- [ ] **Step 10: 提交通用 Content shell**

```bash
git add website/content.config.ts website/nuxt.config.ts website/package.json website/assets/css/main.css 'website/pages/[...slug].vue' website/layouts/docs.vue pnpm-lock.yaml
git add -u -- assets/contract-demo/basic.mmd website/components/ContractDemo.vue website/components/PageShell.vue website/pages/index.vue website/pages/getting-started.vue website/pages/troubleshooting.vue website/pages/migration/v3.vue website/pages/reference.vue
git commit -m "refactor: use a single Nuxt Content docs route"
```

---

### Task 4: 將 records 改寫成六頁手寫內容並刪除整套系統

**Files:**

- Create: `website/content/1.index.md`
- Create: `website/content/2.getting-started.md`
- Create: `website/content/3.writing-diagrams.md`
- Create: `website/content/4.configuration.md`
- Create: `website/content/5.troubleshooting.md`
- Create: `website/content/6.migration/1.v3.md`
- Delete: `website/content/index.md`
- Delete: `website/content/getting-started.md`
- Delete: `website/content/reference.md`
- Delete: `website/content/troubleshooting.md`
- Delete: `website/content/migration/v3.md`
- Delete: `website/components/ReferenceAuthoringRecord.vue`
- Delete: `website/components/ReferenceConfigurationRecord.vue`
- Delete: `website/components/ReferenceDelegatedRecord.vue`
- Delete: `website/reference/records.v1.json`
- Delete: `website/utils/reference-format.ts`
- Delete: `scripts/website/adoption.mjs`
- Delete: `scripts/website/artifact.mjs`
- Delete: `scripts/website/reference-corpus.d.mts`
- Delete: `scripts/website/reference-corpus.mjs`
- Delete: `scripts/website/reference-parity.d.mts`
- Delete: `scripts/website/reference-parity.mjs`
- Delete: `scripts/website/reference-public.d.mts`
- Delete: `scripts/website/reference-public.mjs`
- Delete: `scripts/website/reference-verifier.d.mts`
- Delete: `scripts/website/reference-verifier.mjs`
- Delete: `scripts/website/static-site.mjs`
- Delete: `scripts/website/verify.mjs`
- Delete: `docs/superpowers/plans/2026-08-14-documentation-candidate-shell-spike.md`
- Delete: `docs/spikes/documentation-candidate-shell-result.md`

**Interfaces:**

- Consumes: `records.v1.json` 的 43 筆舊資料與既有 Getting Started/Troubleshooting/Migration prose。
- Produces: 六個一般 Markdown documents；刪除後 repo 不再有 Reference data model 或網站驗證 implementation。

- [ ] **Step 1: 建立簡短 Overview**

`website/content/1.index.md` 只包含內建 frontmatter 與三個內容區塊：

```md
---
title: Nuxt Content Mermaid
description: Render Mermaid diagrams from Markdown in Nuxt Content.
---

# Nuxt Content Mermaid

Render `mermaid` code blocks from Nuxt Content as interactive diagrams while keeping Markdown as the authoring source.

## What it does

- Transforms Mermaid fences from Nuxt Content Markdown.
- Renders diagrams in the browser with the package's built-in renderer.
- Supports lazy loading, themes, expand controls, toolbars, and custom renderer components.

## Requirements

- Node.js `>=22.19.0`
- Nuxt `^4.1.0`
- Nuxt Content `>=3.5.0 <4.0.0`

## Next steps

Start with [Getting Started](/getting-started), then use [Writing Diagrams](/writing-diagrams) and [Configuration](/configuration) as needed.
```

不加入 artifact version、compatibility badge、Contract Demo 或 custom component。

- [ ] **Step 2: 精簡 Getting Started**

將既有安裝內容搬到 `website/content/2.getting-started.md`，移除 exact stable artifact、Contract Demo、release/build evidence 與 Contract Gap 文案。保留以下順序與範例：

1. `## Prerequisites`：Node/Nuxt/Content ranges。
2. `## Install`：`pnpm add @barzhsieh/nuxt-content-mermaid @nuxt/content`。
3. `## Enable the module`：`modules: ['@barzhsieh/nuxt-content-mermaid']`。
4. `## Add your first diagram`：三個節點的 `mermaid` fence。
5. `## Run the application`：`pnpm dev`。
6. `## Next steps`：連到 Writing Diagrams、Configuration、Troubleshooting。

- [ ] **Step 3: 建立 Writing Diagrams**

`website/content/3.writing-diagrams.md` 使用以下固定 headings：

```md
## Mermaid fences
## Fence title and display mode
## The Mermaid component
## Page and diagram configuration
## Configuration precedence
## Mermaid-owned options
```

至少包含以下 records 中的實際使用者範例：

````md
```mermaid
flowchart TD
  A --> B
```

```mermaid {title=Architecture displayMode=compact}
flowchart TD
  A --> B
```
````

```vue
<script setup lang="ts">
const source = encodeURIComponent(`flowchart TD
  A --> B`)
</script>

<template>
  <Mermaid :code="source" />
</template>
```

以一般 prose 說明：

- `pageConfig` 與 direct `config` 不能同時提供。
- Markdown page config 套用到該頁 diagrams；fence/frontmatter config 套用到單一 diagram。
- Fence inline metadata 高於 diagram YAML frontmatter；diagram 設定高於 page/application defaults。
- Mermaid 擁有 diagram grammar 與原生 config semantics；連到 [Mermaid configuration](https://mermaid.js.org/config/configuration.html)。

不要列出 pure-data taxonomy、function/RegExp/Trusted Types allowlist 或 delegated records。

- [ ] **Step 4: 建立 Configuration**

`website/content/4.configuration.md` 使用以下固定 headings：

```md
## General
## Loading and Mermaid initialization
## Theme
## Custom components
## Expand
## Toolbar
## Mermaid-owned configuration
```

每節使用一般 Markdown table 或短 prose，涵蓋下列 package-owned facts：

| Path | Type/shape | Default |
| --- | --- | --- |
| `enabled` | boolean | `true` |
| `debug` | boolean | `false` |
| `loader.lazy` | boolean or options object | enabled |
| `loader.lazy.threshold` | number | no package value |
| `theme.light` | Mermaid theme name | `default` |
| `theme.dark` | Mermaid theme name | `dark` |
| `components.renderer` | component name | built-in renderer |
| `components.spinner` | component name | none |
| `components.error` | component name | none |
| `expand.enabled` | boolean | `true` |
| `expand.margin` | number | `0` |
| `expand.invokeOpenOn.diagramClick` | boolean | `true` |
| `expand.invokeCloseOn.esc` | boolean | `true` |
| `expand.invokeCloseOn.wheel` | boolean | `true` |
| `expand.invokeCloseOn.swipe` | boolean | `true` |
| `expand.invokeCloseOn.overlayClick` | boolean | `true` |
| `expand.invokeCloseOn.closeButtonClick` | boolean | `true` |
| `toolbar.title` | string | `mermaid` |
| `toolbar.fontSize` | string or number | `14px` |
| `toolbar.fullscreenToolbarScale` | number | `1.25` |
| `toolbar.buttons.copy` | boolean | `true` |
| `toolbar.buttons.fullscreen` | boolean | `true` |
| `toolbar.buttons.expand` | boolean | `true` |

Loading 必須把 `loader.init` 說成 Mermaid initialization config 的傳遞入口。最後一節只寫一段邊界與 Mermaid 官方連結，不複製 Mermaid option schema。`theme.useColorModeTheme` 不出現在 Configuration。

- [ ] **Step 5: 精簡 Troubleshooting**

將既有內容搬到 `website/content/5.troubleshooting.md`，保留三個症狀 headings：

```md
## Install fails
## Build fails
## Source stays visible
```

每節保留可直接採取的 confirm/next step，刪除 exact artifact identity、Contract Gap、website failure classification、release evidence 與 escalation taxonomy。最後只連到 GitHub Issues，要求提供 versions、最小 reproduction 與完整錯誤。

- [ ] **Step 6: 精簡 Migration to v3**

將既有 migration prose 搬到 `website/content/6.migration/1.v3.md`，保留實際 migration headings：

```md
## Rename the module key
## Keep module activation at build time
## Transport only pure data at runtime
## Choose page or direct Mermaid config
## Account for property-presence merge
## Treat expand booleans as resets
## Remove useColorModeTheme
## Remove package-root transform imports
## Migration checklist
```

刪除 Frozen Legacy Release、Migration Assistance Window、exact artifact、Website Synchronization、Contract Gap 與 release governance。`Remove useColorModeTheme` 明確說明該 key 在 v3 是 accepted no-op，應直接刪除。

- [ ] **Step 7: 刪除舊內容與整套 Reference infrastructure**

確認 Configuration/Writing/Migration 已吸收本 Task 指定的使用者資訊後，使用 `apply_patch` 刪除本 Task `Files` 區段列出的舊 Markdown、Reference components、records、formatter、十二個 scripts 與兩份舊 spike 文件。

不得保留 records 備份、轉換後 JSON、generated Markdown 或 migration script；Git history 已提供復原來源。

- [ ] **Step 8: 確認網站最終檔案面**

Run:

```bash
rtk rg --files website | sort
```

Expected: 八個程式檔案與六個 Markdown 檔案；沒有 `components/`、`reference/`、`utils/` 或個別 page wrappers。

- [ ] **Step 9: 確認舊系統完全消失**

Run:

```bash
rtk rg -n 'records\.v1|ReferenceAuthoringRecord|ReferenceConfigurationRecord|ReferenceDelegatedRecord|website-reference-model|verify:website|test:website-static|scripts/website|ContractDemo' package.json .github scripts test website
rtk rg -n '\bwebsite\b|ContractDemo' scripts/release-verification .github/workflows/publish.yml test/releaseVerificationOperations.test.ts
```

Expected: 兩個查詢都沒有輸出。正式規格與本計畫會保留這些名稱作為刪除紀錄，因此不要對整個 `docs/` 執行此 no-match assertion。

- [ ] **Step 10: 一次性檢查 Content routes**

Run:

```bash
pnpm dev:prepare
pnpm --dir website generate
```

Expected: exit 0，且 generated output 包含 `/`、`/getting-started`、`/writing-diagrams`、`/configuration`、`/troubleshooting`、`/migration/v3`；不包含 `/reference`。不要新增 route verifier script。

- [ ] **Step 11: 確認 package checks 與網站無關且仍通過**

Run:

```bash
pnpm lint
pnpm test
pnpm test:types
```

Expected: 全部 exit 0，且不執行 website lint/test/typecheck/build。

- [ ] **Step 12: 檢查最終 diff 與提交**

Run:

```bash
rtk git diff --check
rtk git status --short
```

Expected: 沒有 whitespace error；只包含本規格列出的網站簡化與驗證解耦變更。

```bash
git add website/content/1.index.md website/content/2.getting-started.md website/content/3.writing-diagrams.md website/content/4.configuration.md website/content/5.troubleshooting.md website/content/6.migration/1.v3.md
git add -u -- website/content/index.md website/content/getting-started.md website/content/reference.md website/content/troubleshooting.md website/content/migration/v3.md website/components/ReferenceAuthoringRecord.vue website/components/ReferenceConfigurationRecord.vue website/components/ReferenceDelegatedRecord.vue website/reference/records.v1.json website/utils/reference-format.ts scripts/website docs/superpowers/plans/2026-08-14-documentation-candidate-shell-spike.md docs/spikes/documentation-candidate-shell-result.md
git commit -m "docs: replace website records with handwritten guides"
```

---

## 計畫完成條件

- 六個 Markdown documents 是網站唯一內容來源。
- `docs` 是唯一 Content collection。
- `[...slug].vue` 是唯一內容 page，使用 Content 3 queries 與 `ContentRenderer`。
- `docs.vue` 是唯一共用 layout，sidebar/TOC 分別來自 Content navigation/body TOC。
- 舊 Reference、records、scripts、tests、Contract Demo 與 spike artifacts 全部刪除。
- Root、CI、artifact 與 release 不讀取網站。
- 沒有替代 records、schema、生成、parity、freshness 或驗證系統。
