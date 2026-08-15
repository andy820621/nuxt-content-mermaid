# Documentation Website

## 狀態

本規格是文件網站唯一的產品與架構契約。

- 2026-08-15：完成第一階段簡化，網站收斂為一個 Nuxt Content collection、通用文件 route/layout 與六篇手寫 Markdown。
- 2026-08-15：完成第二階段 landing 優化，以薄 Vue shell 排版首頁，並讓 Mermaid demo 保持內容驅動。
- 2026-08-15：完成第三階段品牌資源整合，以正式 wordmark、favicon 與靜態社群 metadata 建立網站識別。
- 2026-08-15：完成第四階段 wordmark 簡化，以單一 SVG 配合 CSS `currentColor` 支援 light/dark theme。

`docs/research/` 內的比較與網站研究是非規範性背景；若研究紀錄與本規格衝突，以本規格為準。

## 決策摘要

網站維持小型、內容驅動的 Nuxt Content 3 架構，但把首頁與文件閱讀介面分成兩個清楚的 seam：

```text
全站 app shell
├── / → pages/index.vue → landing shell
│   └── queryCollection('docs').path('/').first()
│       └── ContentRenderer → 首頁 Markdown Mermaid fence
└── 其他內容路徑 → pages/[...slug].vue → layouts/docs.vue
    ├── queryCollection('docs') → ContentRenderer
    ├── queryCollectionNavigation('docs') → 左側 sidebar
    └── page.body.toc.links → 右側 TOC
```

首頁是獨立、薄的 Vue 排版 shell；它不是另一套內容系統。首頁 Mermaid demo 必須走真正的 Markdown → Nuxt Content → 套件 transform → `ContentRenderer` → Mermaid rendering 流程。

網站仍完全退出 root、CI、artifact 與 release 的品質和交付流程。

## 第一原理

網站只有兩種使用情境：

1. 首次造訪者需要在一個畫面內理解套件用途、看到真實 diagram，並前往 Getting Started。
2. 文件讀者需要在多個主題間導覽、閱讀當前內容，並跳到頁內 heading。

Landing 與 docs layout 解決的是不同問題，因此不應讓 docs layout 特判首頁，也不應把 landing presentation 塞進 content schema。兩者只共享全站 header、theme 與 GitHub 入口。

## 目標

- 讓首頁以最少內容直接說明產品價值。
- 讓首頁 Mermaid demo 經過套件使用者真正採用的 Markdown 流程。
- 保留目前容易理解的文件 collection、catch-all route、sidebar 與 TOC。
- 讓一人維護者主要透過 Markdown 維護公開文件。
- 保留全站 light/dark theme toggle 與 GitHub repository 入口。
- 以正式 wordmark、favicon 與靜態社群圖片建立一致的網站識別。
- 不因首頁視覺優化重建 records、demo contract、生成器或驗證系統。
- 讓網站繼續完全退出套件品質與交付流程。

## 非目標

以下能力不屬於本網站：

- Nuxt UI Pro 或其他文件站框架。
- Nuxt Studio。
- 搜尋 API 或全文搜尋索引。
- Plausible、analytics 或動態 OG Image 生成；網站只使用一張既有靜態社群圖片。
- 多段式行銷首頁、testimonial、blog feed 或 release feed。
- Nuxt ESLint 的 Packages／Guide／Legacy 多層分類。
- Landing collection、data collection、自訂 landing schema 或 landing frontmatter model。
- `index.yml`、landing YAML、MDC 專屬 landing 元件或 demo asset。
- Contract Demo、artifact identity、source disclosure、lazy proof 或 runtime evidence。
- Reference records，或以 JSON、YAML、TypeScript、frontmatter、資料 collection 等形式建立的替代 records。
- 網站專用 verifier、parity、freshness、schema、artifact 或 release 驗證。
- 認證、個人化、request-time API、server-side content service 或發佈策略。

## Nuxt Content 3 邊界

### Collection

網站繼續只有一個 `docs` page collection：

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

不得新增 landing collection、data collection、Zod schema 或 `pageId`。首頁與文件頁都使用同一 collection 的內建 `path`、`title`、`description`、`navigation` 與 `body` 欄位。

### 公開 API

網站只使用 Nuxt Content 3 的公開 API：

- `defineCollection()` 與 `defineContentConfig()`。
- `queryCollection()`。
- `queryCollectionNavigation()`。
- `ContentRenderer`。
- page document 的 `body.toc.links`。
- 未來必要時可使用標準 `.navigation.yml`，但本次不新增。

不得使用 `queryContent()`、`fetchContentNavigation()`、`useContent()`、`index.yml` 或 document-driven mode。

## 全站 app shell

`website/app.vue` 從只渲染 `NuxtPage`，提升為全站共用 shell。它只負責：

- Skip-to-content link。
- 品牌名稱，連到 `/`。
- `Documentation`，連到 `/getting-started`。
- `Troubleshooting`，連到 `/troubleshooting`。
- Light/dark theme toggle。
- GitHub repository link，連到 `https://github.com/andy820621/nuxt-content-mermaid`。
- `NuxtPage`。

Header 在 landing 與所有文件頁都顯示。Landing 不強制 dark mode；theme toggle 在所有頁面都可用。

Theme 使用套件既有的 `useMermaidTheme()` 作為網站與 diagram 的共同狀態，並由全站 root 的 theme attribute 套用 CSS variables。不得為網站另外建立 theme store、theme record 或加入只為 toggle 服務的 UI framework。Theme preference 的跨 reload 持久化不是本次契約。

小螢幕下 header 的品牌、Documentation、Troubleshooting、theme toggle 與 GitHub link 都必須保持可達。文字導覽可以用純 CSS 移到第二列或縮短間距，但本次不引入搜尋、drawer framework 或複雜 navigation state。

## 品牌資源

### 資源角色

`src/assets/` 是網站品牌資源的單一來源。網站不得把相同檔案複製到 `website/public/`，也不得建立品牌 manifest、asset generator 或同步 script。

正式資源分工如下：

| 資源 | 用途 |
| --- | --- |
| `nuxt-content-mermaid-icon.svg` | Header 的獨立圖示。 |
| `nuxt-content-mermaid-wordmark.svg` | Header 唯一 wordmark；Nuxt／Mermaid 路徑使用 `currentColor`，Content 路徑固定為綠色。 |
| `nuxt-content-mermaid-logo.svg` | 完整 icon + wordmark 品牌原稿；本階段不直接渲染。 |
| `nuxt-content-mermaid.png` | Open Graph 與 Twitter 共用的靜態社群圖片。 |
| `nuxt-content-mermaid.webp`、`nuxt-content-mermaid_wide.png` | 既有替代輸出；本階段不作為 metadata 圖片。 |
| `favicon/*` | Browser favicon、PNG icons、Apple touch icon 與未啟用的 manifest 原稿。 |

既有未追蹤的 `facicon/` 目錄在納入 Git 前更名為語意正確的 `favicon/`。`site.webmanifest` 與 Android icons 可以保留為品牌來源，但網站不連結 manifest；本階段不建立 PWA、service worker 或安裝體驗。

### Header wordmark

Header 首頁連結由以下視覺組成：

1. `nuxt-content-mermaid-icon.svg`。
2. 一個 inline `<svg>` wrapper，透過三個 same-origin external `<use>` 引用 `nuxt-content-mermaid-wordmark.svg` 的 `#nuxt`、`#content` 與 `#mermaid` paths。

Wordmark SVG 根層 `color` 使用 `currentColor`；Header CSS 以既有 `--text` token 設定 wrapper 的 `color`，因此 Nuxt／Mermaid paths 隨網站 theme 切換，`#content` path 的 `#00DC82` 保持不變。Vue 不計算 theme-specific asset URL，也不建立第二個 theme state。Icon 是裝飾圖，wordmark wrapper 以 `<title>` 提供 `Nuxt Content Mermaid` 的 accessible name；整組仍是一個可存取的首頁連結。小螢幕可縮小 wordmark 並讓文字導覽換列，但不得退回純文字品牌或隱藏首頁入口。

### Public asset mapping

`website/nuxt.config.ts` 透過 Nitro `publicAssets` 將 repository 的 `src/assets/` 唯讀映射到網站固定的 `/assets/` 路徑。這是網站 build-time 的靜態資源輸入，不是 package artifact 或 release contract。

此方式的約束是：

- 不複製檔案到 `website/public/`。
- 不使用帶 hash 的 Vite asset URL 作為社群 metadata。
- 不新增 runtime environment variable、asset manifest 或部署檢查。
- Root lint、test、typecheck、build、artifact 與 release 繼續完全忽略網站。

### Favicon 與社群 metadata

全站 head 使用 `/assets/favicon/` 下的既有 favicon 與 Apple touch icon。Manifest 不加入 head。

網站正式 origin 固定為：

```text
https://nuxt-content-mermaid.barz.app
```

全站共用以下靜態 metadata：

- `og:site_name = Nuxt Content Mermaid`。
- `og:type = website`。
- `og:image = https://nuxt-content-mermaid.barz.app/assets/nuxt-content-mermaid.png`。
- `twitter:card = summary_large_image`。
- `twitter:image` 使用同一張絕對網址圖片。

Landing 與文件 route 各自以目前 page 的 `title`、`description` 補齊 Open Graph title／description；全站 shell 以當前 route path 和固定 origin 產生 `og:url`。這只是靜態 head metadata，不新增 Nuxt SEO module、OG renderer、canonical generator 或發布驗證。

## Landing page

### Route seam

新增 `website/pages/index.vue` 作為 `/` 的唯一 route。它與 `pages/[...slug].vue` 並存：

- `pages/index.vue` 只處理 `/`。
- `pages/[...slug].vue` 繼續處理 Getting Started、Writing Diagrams、Configuration、Troubleshooting 與 Migration to v3。
- 不在 catch-all route 內加入 `route.path === '/'` 的 presentation 分支。
- 不建立 landing layout；單一 `pages/index.vue` 就是薄 landing shell。

### Content query

Landing shell 必須使用：

```ts
queryCollection('docs').path('/').first()
```

找不到 page 時回傳 404。SEO title 與 description 直接使用 page 的內建欄位。

Hero 右側必須直接渲染：

```vue
<ContentRenderer :value="page" />
```

不得從 page body 解析 diagram source、複製 fence、轉成 component prop，或建立 landing demo adapter。`ContentRenderer` 是首頁內容的唯一 render path。

### `content/1.index.md`

首頁 Markdown 只允許以下內容：

````md
---
title: Mermaid diagrams, native to Nuxt Content
description: Turn Mermaid code blocks into interactive diagrams without leaving your Markdown workflow.
navigation: false
---

```mermaid
flowchart LR
  Markdown --> Content[Nuxt Content]
  Content --> Mermaid
  Mermaid --> Diagram[Interactive diagram]
```
````

約束：

- Frontmatter 只有 `title`、`description` 與 `navigation: false`。
- Body 只有一個 Mermaid fence。
- 不包含 H1、CTA、cards、HTML wrappers、MDC component、artifact version 或 demo metadata。
- `navigation: false` 必須讓首頁不出現在 docs sidebar。
- Diagram source 是普通 Markdown 內容，不搬到 Vue、asset、JSON、YAML 或 TypeScript constant。

### Vue presentation

`pages/index.vue` 只負責：

- 以 page `title` 與 `description` 排版 hero。
- 顯示 `Get started` primary CTA，連到 `/getting-started`。
- 在 hero 右側放置 page `ContentRenderer`。
- 顯示三張固定功能卡片。

三張卡片的 title 固定為：

1. `Write diagrams in Markdown`
2. `Render interactive diagrams`
3. `Keep the source readable`

卡片 description 應以使用者結果描述，避免 `authoring surface`、`module transform`、`fallback contract` 等內部術語。初始文案為：

| Title | Description |
| --- | --- |
| Write diagrams in Markdown | Use familiar `mermaid` fences in Nuxt Content. |
| Render interactive diagrams | Get theme-aware diagrams with built-in controls. |
| Keep the source readable | Preserve readable Markdown when JavaScript is unavailable. |

Cards 是 landing presentation，不進入 frontmatter、collection schema 或另一份資料檔。三筆固定內容可以直接留在 `pages/index.vue`，避免為單一 caller 建立淺薄資料 module。

### Visual direction

可從舊首頁取回以下視覺語言：

- 綠色 accent 與柔和 radial gradient。
- 大型、直接的 hero typography。
- Desktop 採文字／diagram 雙欄；mobile 改為上下堆疊。
- 三張簡短 cards；desktop 三欄、mobile 單欄。
- 清楚的 primary CTA。

不得取回：

- Stable artifact badge。
- Live／evidence badge。
- Source disclosure。
- 第二個 lazy diagram。
- Lazy proof section。
- 重複的 final CTA。
- Contract 或 verifier 語言。

## 文件 routes 與 layout

### Catch-all route

`website/pages/[...slug].vue` 保持現有責任：

- `queryCollection('docs').path(route.path).first()` 讀取文件。
- `queryCollectionNavigation('docs')` 讀取 navigation tree。
- 找不到文件時回傳 404。
- 使用 page `title` 與 `description` 設定 metadata。
- 將 page 與 navigation 傳入 `layouts/docs.vue`。
- 以 `ContentRenderer` 渲染中央內容。

它不處理首頁 presentation，也不需要 landing props 或 conditional layout。

### Docs layout

`website/layouts/docs.vue` 繼續負責：

- 左側 sidebar：來自 `queryCollectionNavigation('docs')`。
- 中央文件 slot。
- 右側 TOC：來自 `page.body.toc.links`。
- Responsive 文件閱讀排版。

因為 header 與 skip link 上移到 `app.vue`，docs layout 不再重複擁有 header。它不增加搜尋、footer community links、surround navigation 或 mobile drawer framework。

### Troubleshooting

- Route 保留 `/troubleshooting`。
- Top navigation label 使用 `Troubleshooting`，不改名為 FAQ。
- 文件仍出現在 sidebar。
- 內容可以把症狀 heading 寫成使用者自然搜尋的問題，但仍是普通 Markdown。
- 不新增 FAQ collection、accordion、disclosure component 或問題資料模型。

## 最終內容樹

```text
website/content/
├── 1.index.md                       # /                    — Landing demo content, navigation: false
├── 2.getting-started.md             # /getting-started     — Getting Started
├── 3.writing-diagrams.md            # /writing-diagrams    — Writing Diagrams
├── 4.configuration.md               # /configuration       — Configuration
├── 5.troubleshooting.md             # /troubleshooting     — Troubleshooting
└── 6.migration/
    └── 1.v3.md                       # /migration/v3         — Migration to v3
```

仍然只有六篇手寫 Markdown。首頁雖不顯示在 sidebar，仍屬於同一個 `docs` page collection。

## 最終網站程式檔案

```text
website/
├── app.vue
├── assets/css/main.css
├── content.config.ts
├── layouts/docs.vue
├── nuxt.config.ts
├── package.json
├── pages/
│   ├── index.vue
│   └── [...slug].vue
└── tsconfig.json
```

網站仍不需要 `components/`、`utils/`、`reference/`、`server/` 或網站專用 scripts/tests。

## 第二階段檔案變更範圍（已完成）

| 檔案 | 動作 | 設計責任 |
| --- | --- | --- |
| `website/pages/index.vue` | 新增 | 查詢首頁 page、404/SEO、hero、CTA、`ContentRenderer` 與三張 cards。 |
| `website/app.vue` | 修改 | 成為全站 shell，提供 header、theme toggle、GitHub 與 skip link。 |
| `website/layouts/docs.vue` | 修改 | 移除重複 header／skip link，只保留 docs sidebar、content 與 TOC。 |
| `website/content/1.index.md` | 修改 | 只留下核准的內建 frontmatter 與一個 Mermaid fence。 |
| `website/assets/css/main.css` | 修改 | 加入全站 header、light/dark tokens、landing hero/cards 與 responsive styles；保留 docs styles。 |

本次不修改：

- `website/content.config.ts`：仍是唯一 `docs` collection，沒有 schema。
- `website/pages/[...slug].vue`：既有文件查詢與 render path 保持不變。
- 其餘五篇文件 Markdown：內容與 routes 保持不變。
- `website/nuxt.config.ts`、`website/package.json`、`pnpm-lock.yaml`：不新增 landing 或 theme dependency。
- Root scripts、CI、artifact 與 release files：網站仍完全退出這些流程。

本次不新增或恢復任何其他檔案。

## 第三階段檔案變更範圍

| 檔案 | 動作 | 設計責任 |
| --- | --- | --- |
| `src/assets/nuxt-content-mermaid-icon.svg` | 納入 Git | Header icon 品牌原稿。 |
| `src/assets/nuxt-content-mermaid-logo.svg` | 納入 Git | 保留完整品牌原稿，本階段不直接渲染。 |
| `src/assets/nuxt-content-mermaid-wordmark.svg` | 納入 Git | Dark mode Header wordmark。 |
| `src/assets/nuxt-content-mermaid-wordmark-dark.svg` | 新增 | Light mode 的黑色文字 wordmark。 |
| `src/assets/facicon/` → `src/assets/favicon/` | 更名並納入 Git | Browser icon 資源；manifest 不啟用。 |
| `website/nuxt.config.ts` | 修改 | 以 Nitro `publicAssets` 將 `src/assets/` 映射到 `/assets/`。 |
| `website/app.vue` | 修改 | 顯示 theme-aware icon／wordmark，設定 favicon 與全站社群 metadata。 |
| `website/assets/css/main.css` | 修改 | Header 品牌圖片與 responsive 尺寸；移除舊 CSS 品牌圖形。 |
| `website/pages/index.vue` | 修改 | 以首頁 page title／description 補齊 Open Graph metadata。 |
| `website/pages/[...slug].vue` | 修改 | 以文件 page title／description 補齊 Open Graph metadata。 |

第三階段不修改：

- `website/content/**`、`website/content.config.ts` 與 `website/layouts/docs.vue`。
- Landing hero、CTA、功能 cards 與真實 Mermaid `ContentRenderer` demo。
- `website/package.json`、workspace 設定與 lockfile。
- Root scripts、CI、artifact 與 release files。

第三階段不新增 dependency、Vue component、content model、schema、generator、manifest pipeline、test 或永久網站驗證。

## 第四階段檔案變更範圍

| 檔案 | 動作 | 設計責任 |
| --- | --- | --- |
| `src/assets/nuxt-content-mermaid-wordmark.svg` | 修改 | 根層 `color` 改為 `currentColor`，paths 與品牌綠色不變。 |
| `src/assets/nuxt-content-mermaid-wordmark-dark.svg` | 刪除 | 移除重複的 theme-specific asset。 |
| `website/app.vue` | 修改 | 以單一 `<svg>` wrapper 和三個 external `<use>` 取代 theme-specific `<img>` 與 computed URL。 |
| `website/assets/css/main.css` | 修改 | 以 `var(--text)` 控制 wordmark 的 `currentColor`。 |

第四階段不修改 favicon、社群 metadata、內容、routes、layout、navigation、Mermaid demo 或品質與交付邊界，也不新增 component、loader、dependency、generator 或驗證。

## 品質與交付邊界

以下 root commands 不得讀取、解析或驗證 `website/**`：

- `pnpm lint`
- `pnpm test`
- `pnpm test:types`
- `pnpm prepack`
- `pnpm verify:source`

CI 不執行網站 lint、test、typecheck、build、generate、browser check 或 content check。Package artifact 與 release scripts 不讀取 website source、manifest、output 或內容。

網站只保留本機 `dev` 與 `generate`。維護者或 AI agent 可以在單次工作中執行 generate 和人工檢查 routes／畫面，但不得把結果升格為永久 verifier、snapshot、manifest 或 release contract。

## 禁止重新發明 records 或 demo contract

最終架構必須持續符合：

- 只有一個 `docs` page collection。
- 沒有 landing collection、data collection 或自訂 schema。
- 沒有 `index.yml`、landing YAML 或 option inventory。
- Landing page 直接查詢 page document，不建立 projection 或 adapter。
- Landing Mermaid fence 是 Markdown body，不是 asset 或 TypeScript constant。
- Sidebar 直接來自 `queryCollectionNavigation()`。
- TOC 直接來自 Markdown headings。
- 沒有 Reference records、record components、virtual module 或 generated Markdown。
- 沒有 Contract Demo、artifact identity、source disclosure、lazy proof 或 evidence taxonomy。
- 沒有 parity、freshness、artifact 或 release verifier。
- AI agent 的臨時檢查結果不得提交為網站資料模型或交付契約。

## 驗收條件

設計實作完成時應滿足：

1. `/` 只由 `pages/index.vue` 處理，不使用 docs layout。
2. Landing 使用 `queryCollection('docs').path('/').first()` 取得首頁 page。
3. Hero 的 title／description 來自 page 內建欄位，CTA 連到 `/getting-started`。
4. Hero 右側直接使用 `<ContentRenderer :value="page" />`。
5. `content/1.index.md` 只有三個核准 frontmatter fields 與一個 Mermaid fence。
6. 首頁 Mermaid diagram 成功經過 Markdown → Content → package transform → browser render。
7. 三張 cards 使用核准的 titles，且不由 schema 或資料檔生成。
8. Header 在 landing 與文件頁都顯示 Documentation、Troubleshooting、theme toggle 與 GitHub link。
9. Theme toggle 同步網站外觀與 Mermaid theme，landing 不強制 dark mode。
10. `pages/[...slug].vue` 繼續處理五個文件 routes，`layouts/docs.vue` 繼續提供 sidebar 與 TOC。
11. `/` 不出現在 sidebar；Troubleshooting 保留 route、名稱與 sidebar entry。
12. Desktop landing 是 hero 雙欄與三欄 cards；mobile 改為單欄，header 仍可操作。
13. Repo 中沒有 landing collection/schema、index.yml、MDC landing component、demo asset 或替代 records。
14. Contract Demo、artifact identity、lazy proof、verifier 與其他網站驗證系統仍不存在。
15. Root、CI、artifact 與 release 繼續不讀取或驗證網站。
16. 一次性 `pnpm --dir website generate` 成功產生既有 routes，但不形成永久 gate。

## 官方與研究依據

- [Nuxt Content：Collection Types](https://content.nuxt.com/docs/collections/types)
- [Nuxt Content：queryCollection](https://content.nuxt.com/docs/utils/query-collection)
- [Nuxt Content：queryCollectionNavigation](https://content.nuxt.com/guide/displaying/navigation)
- [Nuxt Content：ContentRenderer](https://content.nuxt.com/docs/components/content-renderer)
- [Nuxt ESLint landing page](https://eslint.nuxt.com/)
- [Nuxt ESLint module documentation](https://eslint.nuxt.com/packages/module)
- [Nuxt ESLint FAQ](https://eslint.nuxt.com/guide/faq)
- `docs/research/documentation-site-architecture-comparison.md`
- `docs/research/nuxt-eslint-site-experience.md`
