# Documentation Website

## 狀態

本規格是目前文件網站唯一的產品與架構契約。它描述已接受的最終邊界，不保存 agent workflow、逐步實作歷史或被淘汰的替代方案。

## 心智模型

網站是一個獨立、內容驅動的 Nuxt Content application：

```text
全站 app shell
├── locale-aware header、theme controls、mobile navigation、footer
├── / 與 /zh → pages/index.vue → landing presentation
│   └── ContentRenderer → Markdown Mermaid fence → LandingMermaidDemo
└── 其他內容路徑 → pages/[...slug].vue → layouts/docs.vue
    ├── ContentRenderer → 手寫 Markdown
    ├── queryCollectionNavigation('docs') → locale-aware sidebar
    └── page.body.toc.links → DocsToc → desktop scrollspy TOC
```

Landing 與 docs layout 解決不同問題，但共用同一個 Content collection、app shell、theme、locale 與品牌資源。網站不是 package release verifier，也不建立另一套 public configuration model。

## 產品目標

- 首次造訪的 Package User 能理解套件用途、看到真實 Mermaid diagram，並前往 Getting Started。
- Package User 依序完成模組啟用與第一張圖、diagram authoring、configuration，接著依需求深入主題與樣式、自訂渲染或互動操作；遇到問題可前往 troubleshooting，升級時可前往 v3 migration。
- Production website 是 canonical package documentation；repository README 只保留 bounded distribution summary。
- English 與 Traditional Chinese 使用相同資訊架構；英文為 canonical language，中文是 best-effort translation。
- Desktop 與 mobile 都具備清楚的 navigation、active state、keyboard focus 與無水平溢位的閱讀體驗。
- Light、dark 與 system preference 同時控制網站外觀與 Mermaid rendering，使用者選擇可跨 reload 保存。
- 一人維護者主要透過手寫 Markdown 維護公開內容。

## 非目標

- Generated Reference、option records、parity、freshness 或 artifact verifier。
- Contract Demo、lazy proof 或 evidence taxonomy；首頁核准的 Markdown／Rendered UI 雙檢視除外。
- Landing schema、YAML、MDC landing component、資料 collection 或自訂內容生成器。
- 搜尋 API、analytics、動態 OG image、blog、release feed 或認證／個人化。
- Request-time content API、server-rendering dependency 或 provider-specific fallback。
- Provider-specific deployment、DNS、TLS、redirect 或 hosting lifecycle management。
- 讓 root package CI、artifact 或 release workflow 驗證 website。

## Content 與 routes

網站只有一個 `docs` page collection。所有公開文章都是手寫 Markdown：

```text
website/content/
├── 1.index.md                       # /
├── 2.getting-started.md             # /getting-started
├── 3.writing-diagrams.md            # /writing-diagrams
├── 4.configuration.md               # /configuration
├── 5.advanced/
│   ├── 1.themes-and-styling.md      # /advanced/themes-and-styling
│   ├── 2.custom-rendering.md        # /advanced/custom-rendering
│   └── 3.interactions.md            # /advanced/interactions
├── 6.troubleshooting.md             # /troubleshooting
├── 7.migration/1.v3.md              # /migration/v3
└── zh/
    ├── 1.index.md                   # /zh
    ├── 2.getting-started.md         # /zh/getting-started
    ├── 3.writing-diagrams.md        # /zh/writing-diagrams
    ├── 4.configuration.md           # /zh/configuration
    ├── 5.advanced/
    │   ├── 1.themes-and-styling.md  # /zh/advanced/themes-and-styling
    │   ├── 2.custom-rendering.md    # /zh/advanced/custom-rendering
    │   └── 3.interactions.md        # /zh/advanced/interactions
    ├── 6.troubleshooting.md         # /zh/troubleshooting
    └── 7.migration/1.v3.md          # /zh/migration/v3
```

首頁設定 `navigation: false`，不出現在 docs navigation。`advanced` 只提供三個 leaf pages，不提供 `/advanced` 或 `/zh/advanced` landing route。網站沒有 `/reference` route；public configuration guidance 位於 `/writing-diagrams` 與 `/configuration`。

Advanced pages 的責任如下：

- Themes and Styling 說明 `useMermaidTheme()`、Theme Resolution Policy、color-mode coexistence 與 package-owned CSS hooks。
- Custom Rendering 說明 Custom Renderer Candidate 的解析、Rendering Ownership、extension inputs，以及 built-in renderer 的 fallback 邊界。
- Interactions 說明 Built-in Renderer 的 toolbar、copy、fullscreen、expand、zoom 與可及性操作；成功解析的 Custom Renderer 取代這些行為。

`queryCollectionNavigation('docs')` 依此內容樹產生 sidebar 與 mobile navigation。`PUBLIC_ROUTES` 僅列出公開 leaf routes，並同時供 prerender 與 sitemap 使用。

`@nuxtjs/i18n` 使用 `prefix_except_default`：英文 route 不加 prefix，繁中使用 `/zh`。Shell labels 由小型 locale JSON 管理，文章內容仍由各語系 Markdown 負責。`filterLocaleNavigation()` 只保留目前 locale 的 navigation tree；locale switcher 對應目前 route 的另一語系位置。

## App shell

`website/app.vue` 擁有所有頁面共用的：

- Skip-to-content link。
- 品牌與首頁 link。
- Desktop 的 Documentation 與 Troubleshooting links。
- Theme toggle、locale switcher 與 GitHub repository link。
- Mobile documentation menu。
- Route-aware Open Graph metadata。
- Nuxt page/layout outlet。
- Project ownership 與 MIT License footer。

Footer 顯示 `© 2025–present BarZ Hsieh · MIT License`。作者與 license links 在安全的新分頁開啟；footer 在短頁面貼齊 viewport 底部，長頁面則跟隨內容。

### Responsive navigation

Desktop header 直接顯示主要 links；文件頁另有 sticky sidebar。`48rem` 以下收斂為品牌、theme、GitHub、locale 與 hamburger，文件 links 移入全畫面 menu。

Mobile menu：

- 使用與 sidebar 相同的 locale-filtered navigation。
- 開啟時 main/footer inert 且頁面不可捲動；header controls 仍可操作。
- link click、Escape、route change 或離開 mobile breakpoint 時關閉。
- Escape 關閉後焦點回到 hamburger。
- 提供 `aria-expanded`、`aria-controls`、動態 accessible label 與 `aria-current="page"`。

Desktop sidebar 與 mobile menu 的 active state 都使用 accent 指示線、accent 文字、較高字重與 soft background；hover、focus-visible 與 active state 必須可區分。

## Landing page

`pages/index.vue` 只處理目前 locale 的首頁。它查詢對應的 page document，從內建 `title`／`description` 產生 hero，並把 CTA 指向 locale-aware Getting Started。

Hero 是首頁唯一的直接子 section。右側 `ContentRenderer` 只將 `ContentMermaidTransport` 映射到 `LandingMermaidDemo`：

- `Rendered UI` 預設顯示由 package transform 產生的 Mermaid diagram。
- `Markdown` 顯示同一份 encoded source，不建立第二份 demo record。
- 兩個 tab 具有清楚的 active、hover 與 focus state。
- Desktop 使用雙欄；mobile 上下堆疊並容許 320px viewport 收縮。

## Docs layout

`pages/[...slug].vue` 查詢目前 locale 的 page 與 navigation，並交由 `layouts/docs.vue` 呈現 sidebar、文章與 desktop TOC。

`DocsToc` 遞迴呈現 `page.body.toc.links`；`useDocsToc` 以 IntersectionObserver 與 hash navigation 維持目前 heading：

- 初次載入中段、直接開啟 hash、捲動及 route 更新都能得到正確 active heading。
- Active link 使用 rail、accent 文字、較高字重與 `aria-current="location"`。
- 原生 hash navigation 保留。
- 缺少 heading 或 route 更新不得遺留重複 observer。
- `62rem` 以下隱藏右側 TOC，不建立 mobile TOC state。

## Theme 與 site controls

`@nuxtjs/color-mode` 提供 system-aware、persistent website theme；`useWebsiteTheme` 把 color mode 與 package `useMermaidTheme()` 同步，使 diagram 在 theme 變更時重新 render。

`ThemeToggle`：

- 顯示下一個 action 的 accessible label 與 tooltip。
- 支援 View Transition animation。
- `prefers-reduced-motion`、API 不存在或 transition rejected 時直接切換。
- Busy state 不接受重複操作，visible icon 仍表達目標 theme。

`LocaleSwitcher` 只顯示目標語系文字；GitHub、theme 與 locale controls 使用一致的視覺重量。外部 links 使用 `target="_blank"` 與 `rel="noopener noreferrer"`。

## Code readability

- Light theme 使用 `github-light` Shiki tokens。
- Dark theme 使用 `github-dark-high-contrast` 的 `--shiki-dark` tokens。
- Fenced code 使用一致字級、line height、長行換行與 overflow fallback。
- Inline code 具有可辨識的 surface、padding 與圓角。
- Desktop／mobile、light／dark 下都不得因長 install command 產生頁面水平溢位。

## 品牌與 metadata

網站使用 repository-owned wordmark、icon、favicon 與靜態 social image。Wordmark 透過 `currentColor` 支援 light/dark theme；所有必要 icon 由 local icon collections 提供，不依賴 runtime icon provider。

全站以 production identity `https://nuxt-content-mermaid.barz.app` 產生 canonical、Open Graph 與 sitemap URLs。這個 origin 是公開套件文件的 canonical authority；hosting provider、DNS activation 與 production evidence 屬於營運紀錄，不是 durable product contract。

## Architecture boundaries

- 只有一個 `docs` page collection。
- 不使用 `queryContent()`、`fetchContentNavigation()`、`useContent()`、`index.yml` 或 document-driven mode。
- Landing Mermaid fence 是 Markdown body，不是 asset 或 TypeScript constant。
- Sidebar 直接來自 `queryCollectionNavigation()`；TOC 直接來自 Markdown headings。
- Locale filtering 只處理 navigation projection，不建立第二份 collection。
- 沒有 Reference records、virtual module、generated Markdown 或 website artifact verifier。
- AI agent 的研究、plans、task reports、ports、tokens、screenshots 與臨時檢查結果不得成為 durable product contract。

## 品質與交付邊界

Root commands 與 CI 排除 `website/**`；package artifact 與 release scripts 不讀取 website source、output 或內容。網站保留自己的 `dev`、`generate`、`test` 與 typecheck invocation。

Baseline 整合至少驗證：

```bash
pnpm lint --fix
pnpm test
pnpm test:types
pnpm --dir website test
pnpm --dir website generate
pnpm exec vue-tsc -p website/tsconfig.json --noEmit
git diff --check
```

Website-local tests 應涵蓋：

- English／Traditional Chinese navigation filtering 與 locale switching。
- Landing source／rendered tabs 與 320px containment。
- Theme persistence、Mermaid redraw、animation、reduced-motion 與 fallback。
- Tooltip、accessible labels、safe external links 與 local icon rendering。
- Mobile menu focus／inert／active state。
- Desktop page TOC scrollspy、hash navigation 與 responsive visibility。
- Shared footer ownership、license links 與 short-page placement。

這些驗證只保護 Documentation Website baseline，不形成 package release contract。Static output 的 route、canonical metadata、sitemap、hydration 與 no-JavaScript reading path 均屬 website-local verification boundary。
