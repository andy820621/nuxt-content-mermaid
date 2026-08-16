# Website i18n 最小整合設計

## 目標

讓 `website/` 使用 `@nuxtjs/i18n` 管理英文與繁體中文路由，同時保留目前 Nuxt Content 的單一 `docs` collection。繁體中文內容由 `content/ch/` 正規化為 `content/zh/`，公開 URL 由 `/ch/...` 正規化為 `/zh/...`。

## 現況與設計邊界

Portfolio 2024 將 i18n 分成四層：模組註冊、locale 路由、UI message、依 locale 選擇 Content collection。`website/` 已經把兩種語言放在同一個 Content collection 中，因此只需要導入前三層，不能照搬 Portfolio 的 `docs_en/docs_zh` collection duplication。

目前 `website/content/` 的英文檔案產生 root URL，`website/content/ch/` 的檔案產生 `/ch/...` URL。正規化後，`website/content/zh/` 產生 `/zh/...`，並以 `prefix_except_default` 對應 `en` 無前綴、`zh` 使用 `/zh` 前綴。

## 採用方案

### 1. Nuxt i18n bootstrap

修改 `website/package.json`，加入 Portfolio 目前使用的 `@nuxtjs/i18n@^10.6.0`，並更新 workspace lockfile。

修改 `website/nuxt.config.ts`：

- 在 `modules` 加入 `@nuxtjs/i18n`。
- 定義 `en` 與 `zh` 的 typed locale objects。
- `en` 使用 `en-US`，`zh` 使用 `zh-TW`。
- 使用 `strategy: 'prefix_except_default'`，`en` 為 default locale。
- 第一階段關閉 browser-language auto redirect，讓靜態網站的 URL 成為唯一語系來源，避免首次造訪被瀏覽器偏好語言改寫。

新增 `website/i18n/i18n.config.ts` 與兩個小型 JSON message 檔案，只涵蓋網站 shell、語系切換、landing feature 與文件 layout 的固定文字。Markdown 文件本身仍由各語系內容檔負責，不把文章內容搬進 JSON。

### 2. Content 路徑正規化

將 `website/content/ch/` 改名為 `website/content/zh/`，並將繁中 Markdown 內的 `/ch/...` 內部連結改為 `/zh/...`。不改變英文檔案、frontmatter schema 或 `docs` collection 定義。

### 3. Locale-aware page data

修改 `website/pages/index.vue`，使用 `useI18n()` 與 `useLocalePath()`：

- 英文首頁查詢 `/`。
- 中文首頁查詢 `/zh`。
- `useAsyncData` key 包含 locale，避免切換語系後沿用錯誤 payload。
- landing CTA 使用 locale-aware path。

修改 `website/pages/[...slug].vue`：

- 以目前 `route.path` 查詢 Content，讓 `/getting-started` 與 `/zh/getting-started` 自動對應各自文件。
- navigation 的 async key 包含 locale。
- 將 navigation 過濾為目前 locale，避免 sidebar 混入另一語系。

新增 `website/utils/filterLocaleNavigation.ts`，以目前 locale root 與全部 locale roots 過濾 `ContentNavigationItem` 樹；保留有符合 locale 子項目的群組節點。

### 4. Locale-aware shell

修改 `website/app.vue`：

- `htmlAttrs.lang` 使用 `localeProperties.language`。
- brand、Documentation、Troubleshooting 等站內連結使用 `useLocalePath()`。
- 導航資料依目前 locale 過濾。
- 加入簡單的語系切換連結，使用 `useSwitchLocalePath()` 在同一路由切換 `en` / `zh`。
- 固定文字改用 `$t()`。

修改 `website/layouts/docs.vue` 與 `website/components/LandingMermaidDemo.vue`，將可見的固定 label、ARIA label 與 tab 名稱改用 `$t()`；Content 的標題與 description 維持來自 Markdown。

## 資料流

```text
URL (/getting-started 或 /zh/getting-started)
  -> @nuxtjs/i18n 設定 locale
  -> useLocalePath / useSwitchLocalePath 產生同語系連結
  -> queryCollection('docs').path(route.path)
  -> Nuxt Content 回傳對應語系 Markdown
  -> page/layout/rendered Mermaid 使用同一份 page data
```

## 錯誤處理與相容性

- 保留目前 page not found 的 `createError` 行為。
- 如果語系頁面不存在，仍由既有 404 流程處理，不在 i18n layer 自動 fallback 到另一語系內容，避免英文內容意外顯示在中文 URL。
- 不加入 Portfolio 的 collection fallback、browser auto redirect、Sitemap 自訂 route pruning 或完整 SEO schema；這些不屬於本次最小整合。
- `content.config.ts` 維持單一 `docs` collection，避免同一套文件 schema 被 locale 複製。

## 測試與驗證

新增或調整測試，覆蓋：

1. 英文首頁與文件路由仍可查詢與渲染。
2. `/zh`、`/zh/getting-started` 對應 `content/zh/` 文件。
3. 語系切換會由英文 route 對應到中文 route，反向亦然。
4. navigation 與 sidebar 不會混入另一語系。
5. `html lang` 在英文為 `en-US`、中文為 `zh-TW`。

執行：

```bash
pnpm --filter nuxt-content-mermaid-website exec nuxt prepare
pnpm --filter nuxt-content-mermaid-website test
pnpm exec vue-tsc -p website/tsconfig.json --noEmit
pnpm --filter nuxt-content-mermaid-website generate
```

若目前測試只覆蓋 landing page，會補上最小的 route/content integration assertion；不為 i18n 引入新的測試框架或 e2e 基礎設施。

## 不在本次範圍

- 將 `docs` 拆成 `docs_en` / `docs_zh`。
- 翻譯套件 API、Mermaid DSL 或 Markdown source。
- 引入 browser-language 偵測、cookie redirect 或完整 hreflang/canonical SEO 管理。
- 重構現有網站 layout 或 Content schema。
