# Website Brand Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 `src/assets/` 的正式品牌資源整合到文件網站 Header、favicon 與靜態社群 metadata，同時保持既有內容架構及網站交付邊界不變。

**Architecture:** Nitro `publicAssets` 將 repository 的 `src/assets/` 唯讀映射到 `/assets/`；`app.vue` 依既有 theme state 選擇 Header wordmark，並提供全站 favicon、Open Graph 與 Twitter metadata。各 page 只補上自身的社群 title／description，不改動 Nuxt Content query 或 renderer。

**Tech Stack:** Nuxt 4、Nitro、Vue 3、Unhead／`useHead()`／`useSeoMeta()`、plain CSS。

## Global Constraints

- 正式契約是 commit `33503eb` 的 `docs/specs/documentation-website.md`；若本計畫與規格衝突，以規格為準並停止實作。
- `src/assets/` 是唯一品牌來源；不得複製到 `website/public/`。
- 網站正式 origin 固定為 `https://nuxt-content-mermaid.barz.app`。
- Header 使用 icon 加 theme-aware wordmark；dark mode 使用白色原版，light mode 使用新增的黑色 `wordmark-dark.svg`。
- 不連結 `site.webmanifest`，不建立 PWA、service worker、動態 OG renderer、asset manifest、生成器或同步 script。
- 不修改 `website/content/**`、collection、query、layout 或首頁 Mermaid `ContentRenderer` 流程。
- 不新增 dependency、Vue component、schema、test 或永久網站驗證。
- Root、CI、artifact 與 release 繼續完全忽略網站；只執行一次性 website prepare／generate 與人工畫面檢查。
- 現有未追蹤品牌資源是使用者核准的正式資源；不得遺失或改寫未列入規格的圖像內容。

---

## 最終檔案地圖

### 建立／納入 Git

- `src/assets/nuxt-content-mermaid-icon.svg`
- `src/assets/nuxt-content-mermaid-logo.svg`
- `src/assets/nuxt-content-mermaid-wordmark.svg`
- `src/assets/nuxt-content-mermaid-wordmark-dark.svg`
- `src/assets/favicon/*`（由未追蹤的 `facicon/` 更名）

### 修改

- `website/nuxt.config.ts`
- `website/app.vue`
- `website/assets/css/main.css`
- `website/pages/index.vue`
- `website/pages/[...slug].vue`

### 完成後刪除

- `docs/superpowers/plans/2026-08-15-website-brand-assets.md`（正式規格保留；計畫只留在 Git history）

---

### Task 1: 建立單一品牌資源公開路徑

**Files:**

- Create: `src/assets/nuxt-content-mermaid-wordmark-dark.svg`
- Rename: `src/assets/facicon/` → `src/assets/favicon/`
- Add: `src/assets/nuxt-content-mermaid-icon.svg`
- Add: `src/assets/nuxt-content-mermaid-logo.svg`
- Add: `src/assets/nuxt-content-mermaid-wordmark.svg`
- Modify: `website/nuxt.config.ts`

**Interfaces:**

- Consumes: repository 內正式品牌檔案與 Nuxt config 的 `import.meta.url`。
- Produces: `/assets/<filename>` 與 `/assets/favicon/<filename>` 固定公開路徑，供 Task 2 的 Header 和 metadata 使用。

- [ ] **Step 1: 正規化 favicon 目錄並建立 light-mode wordmark**

執行精確 rename，接著以原版 wordmark 為內容基線建立新檔：

```bash
mv src/assets/facicon src/assets/favicon
cp src/assets/nuxt-content-mermaid-wordmark.svg src/assets/nuxt-content-mermaid-wordmark-dark.svg
```

再用 `apply_patch` 只把新檔根 `<svg>` 的：

```xml
color="#FFFFFF"
```

改成：

```xml
color="#000000"
```

三個 `<path>`、尺寸、viewBox、title 與綠色 `#00DC82` 必須逐 byte 保持原版內容。

- [ ] **Step 2: 用 Nitro 映射 repository 品牌目錄**

將 `website/nuxt.config.ts` 改為：

```ts
import { fileURLToPath } from 'node:url'

const brandAssetsDir = fileURLToPath(new URL('../src/assets', import.meta.url))

export default defineNuxtConfig({
  modules: [
    '@nuxt/content',
    '@barzhsieh/nuxt-content-mermaid',
  ],
  css: ['~/assets/css/main.css'],
  nitro: {
    publicAssets: [
      {
        baseURL: '/assets',
        dir: brandAssetsDir,
      },
    ],
  },
  compatibilityDate: '2025-11-24',
})
```

不得新增 runtime config、Vite alias、copy hook 或 public-directory duplicate。

- [ ] **Step 3: 重新產生 Nuxt types 並驗證靜態輸出**

Run:

```bash
pnpm --dir website exec nuxi prepare
pnpm --dir website generate
test -f website/.output/public/assets/nuxt-content-mermaid-icon.svg
test -f website/.output/public/assets/nuxt-content-mermaid-wordmark.svg
test -f website/.output/public/assets/nuxt-content-mermaid-wordmark-dark.svg
test -f website/.output/public/assets/nuxt-content-mermaid.png
test -f website/.output/public/assets/favicon/favicon.ico
test -f website/.output/public/assets/favicon/apple-touch-icon.png
```

Expected: 所有 commands exit 0；沒有建立 `website/public/` 或改動 lockfile。

- [ ] **Step 4: 提交品牌來源與靜態映射**

```bash
git add src/assets/nuxt-content-mermaid-icon.svg src/assets/nuxt-content-mermaid-logo.svg src/assets/nuxt-content-mermaid-wordmark.svg src/assets/nuxt-content-mermaid-wordmark-dark.svg src/assets/favicon website/nuxt.config.ts
git diff --cached --check
git commit -m "chore(website): expose brand assets"
```

---

### Task 2: 套用 Header 品牌與社群 metadata

**Files:**

- Modify: `website/app.vue`
- Modify: `website/assets/css/main.css`
- Modify: `website/pages/index.vue`
- Modify: `website/pages/[...slug].vue`
- Delete: `docs/superpowers/plans/2026-08-15-website-brand-assets.md`

**Interfaces:**

- Consumes: Task 1 的固定 `/assets/` 路徑、既有 `activeTheme` 與各 Nuxt Content page 的 `title`／`description`。
- Produces: theme-aware Header、browser icons、每個 route 的完整靜態分享 metadata；不改變任何頁面內容或 navigation。

- [ ] **Step 1: 在 app shell 定義品牌 URL 與 head metadata**

在 `website/app.vue` 既有 setup 中加入：

```ts
const siteOrigin = 'https://nuxt-content-mermaid.barz.app'
const socialImageUrl = `${siteOrigin}/assets/nuxt-content-mermaid.png`
const route = useRoute()

const wordmarkUrl = computed(() => activeTheme.value === 'dark'
  ? '/assets/nuxt-content-mermaid-wordmark.svg'
  : '/assets/nuxt-content-mermaid-wordmark-dark.svg',
)
```

把既有 `useHead()` 擴充為：

```ts
useHead(() => ({
  htmlAttrs: {
    'data-theme': activeTheme.value,
  },
  link: [
    { rel: 'icon', href: '/assets/favicon/favicon.ico', sizes: 'any' },
    { rel: 'icon', type: 'image/png', href: '/assets/favicon/favicon-32x32.png', sizes: '32x32' },
    { rel: 'icon', type: 'image/png', href: '/assets/favicon/favicon-16x16.png', sizes: '16x16' },
    { rel: 'apple-touch-icon', href: '/assets/favicon/apple-touch-icon.png', sizes: '180x180' },
  ],
}))
```

並加入全站共用 metadata：

```ts
useSeoMeta(() => ({
  ogSiteName: 'Nuxt Content Mermaid',
  ogType: 'website',
  ogUrl: new URL(route.path, siteOrigin).href,
  ogImage: socialImageUrl,
  ogImageAlt: 'Nuxt Content Mermaid',
  twitterCard: 'summary_large_image',
  twitterImage: socialImageUrl,
  twitterImageAlt: 'Nuxt Content Mermaid',
}))
```

- [ ] **Step 2: 以 icon 與 wordmark 取代 Header 純文字品牌**

將 `.site-brand` 的純文字內容改為：

```vue
<NuxtLink
  class="site-brand"
  to="/"
>
  <img
    class="site-brand__icon"
    src="/assets/nuxt-content-mermaid-icon.svg"
    alt=""
    width="96"
    height="96"
  >
  <img
    class="site-brand__wordmark"
    :src="wordmarkUrl"
    alt="Nuxt Content Mermaid"
    width="743"
    height="50"
  >
</NuxtLink>
```

Icon 保持 decorative；首頁 link 的 accessible name 由 wordmark alt 提供。

- [ ] **Step 3: 更新 Header 品牌 CSS**

讓 `.site-brand` 使用 flex，刪除整個 `.site-brand::before` rule，並加入：

```css
.site-brand {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.65rem;
  text-decoration: none;
}

.site-brand__icon {
  flex: none;
  width: 2rem;
  height: 2rem;
}

.site-brand__wordmark {
  display: block;
  width: clamp(10.75rem, 17vw, 13rem);
  height: auto;
}
```

在既有 `@media (max-width: 25rem)` 中移除 `.site-brand` 的 `max-width`／`line-height`，改為：

```css
.site-brand__wordmark {
  width: 10.5rem;
}
```

其餘 Header、navigation、theme button、GitHub button、landing 與 docs CSS 不變。

- [ ] **Step 4: 補齊每頁 Open Graph title 與 description**

在 `website/pages/index.vue` 與 `website/pages/[...slug].vue` 現有 `useSeoMeta()` 各加入：

```ts
ogTitle: page.value.title,
ogDescription: page.value.description,
```

不得移動 query、改 async-data key、加入 SEO module 或修改 Markdown。

- [ ] **Step 5: 執行一次性 generate 與輸出檢查**

Run:

```bash
pnpm --dir website exec nuxi prepare
pnpm --dir website generate
rg -n 'https://nuxt-content-mermaid\.barz\.app/assets/nuxt-content-mermaid\.png' website/.output/public/index.html website/.output/public/getting-started/index.html
rg -n 'summary_large_image|/assets/favicon/favicon\.ico|/assets/favicon/apple-touch-icon\.png' website/.output/public/index.html
rg -n 'Mermaid diagrams, native to Nuxt Content|Getting Started' website/.output/public/index.html website/.output/public/getting-started/index.html
```

Expected: commands exit 0；首頁與文件頁包含相同社群圖片，並保有各自 title／description。

- [ ] **Step 6: 做人工 responsive／theme 驗收**

啟動網站並使用 browser skill 檢查：

```bash
pnpm --dir website dev
```

驗收矩陣：

| Viewport | Theme | 必須確認 |
| --- | --- | --- |
| Desktop | Light | 黑色／綠色 wordmark、icon、導覽、GitHub 與 Mermaid demo 正常。 |
| Desktop | Dark | 白色／綠色 wordmark、icon、導覽、GitHub 與 Mermaid demo 正常。 |
| Mobile | Light | Header 可換列但沒有溢出；所有入口仍可達。 |
| Mobile | Dark | Wordmark 切換正確；首頁與 docs route 都沒有水平捲動。 |

另外開啟 `/getting-started`，確認 sidebar／TOC、theme toggle 與內容 renderer 未回歸。不要保存 screenshot test、snapshot 或 verifier。

- [ ] **Step 7: 刪除已完成計畫並提交 UI 實作**

使用 `apply_patch` 刪除本計畫，再執行：

```bash
git add website/app.vue website/assets/css/main.css website/pages/index.vue 'website/pages/[...slug].vue'
git add -u docs/superpowers/plans/2026-08-15-website-brand-assets.md
git diff --cached --check
git status --short
git commit -m "feat(website): apply brand identity"
```

Expected: 最終 working tree clean；除已完成計畫的刪除外，兩個 implementation commits 只包含正式規格列出的品牌資源與五個網站檔案，implementation plan 只存在於 Git history。
