# Nuxt ESLint 官方文件網站體驗與實作研究

研究日期：2026-08-15

## 結論

Nuxt ESLint 的 live 網站是一個刻意精簡的套件文件站：首頁只做定位與導流，文件頁採「全站 header＋左側 navigation＋內容＋右側 TOC」，FAQ 也只是普通 Markdown headings 與表格，沒有自訂 accordion 或複雜內容模型。[首頁](https://eslint.nuxt.com/)；[Module](https://eslint.nuxt.com/packages/module)；[FAQ](https://eslint.nuxt.com/guide/faq)

但研究時必須區分兩個版本面：

- **Live UI**：以下可觀察體驗來自 2026-08-15 實際部署的 `eslint.nuxt.com`。
- **Current main source**：實作證據固定在官方 repo SHA [`07aebbced575c549bba37f20d6e980b5696597ea`](https://github.com/nuxt/eslint/commit/07aebbced575c549bba37f20d6e980b5696597ea)。

兩者並非完全同步：live FAQ 表格仍列出 legacy packages；該 SHA 的 FAQ 原始檔已縮成三個現行 packages。因此不能把 live 內容與 main source 混稱為同一版本。[Live FAQ](https://eslint.nuxt.com/guide/faq)；[main FAQ source](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/content/2.guide/0.faq.md#L16-L30)

## 1. Header、top navigation、search 與 GitHub 入口

### Live UI

- 桌面 header 左側是 `Nuxt ESLint` 首頁入口，中間依序是 `Documentation`、`FAQ`、`Releases`，右側是 GitHub icon link；GitHub link 的 accessible name 是 `Nuxt ESLint on GitHub`。[首頁](https://eslint.nuxt.com/)；[Module](https://eslint.nuxt.com/packages/module)
- `Releases` 直接導向官方 GitHub releases；GitHub icon 則導向 repo 首頁。[首頁](https://eslint.nuxt.com/)
- 搜尋不在桌面 header 主列。進入 docs 後，搜尋入口位於左側 sidebar 頂端，顯示 `Search...` 與 `⌘ K`；點擊後會出現 placeholder／accessible label 都是 `Search...` 的輸入框。[Module](https://eslint.nuxt.com/packages/module)
- 首頁沒有可見搜尋入口；它只保留 top navigation 與 GitHub 入口。[首頁](https://eslint.nuxt.com/)

### Current main source

- `app.vue` 以 `links` 定義 Documentation、FAQ、GitHub Releases，並在 `UHeader` right slot 放 `UColorModeButton` 與 GitHub `UButton`。[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L15-L55)
- 搜尋資料由 client-side `useLazyFetch('/api/search.json')` 取得；全域 `LazyUContentSearch` 接收 files、navigation、links。[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L30-L37)；[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L108-L114)
- docs layout 把 `UContentSearchButton` 與 `UNavigationTree` 放在左側 `UAside`；mobile panel 另外使用 lazy search button 與同一 navigation tree。[docs layout](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/layouts/docs.vue#L5-L20)；[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L57-L71)

## 2. Landing page 結構與 CTA

### Live UI

- 首屏只有一句價值主張：`All-in-one ESLint integration for Nuxt`，接一段簡短描述與唯一 primary CTA `Get Started`，導向 `/packages/module`。[首頁](https://eslint.nuxt.com/)
- 下方只有一個 `Packages` section，包含 Nuxt Module、ESLint Config、ESLint Plugin 三張 cards；每張卡用一句話解釋整合層級並導向各自文件。[首頁](https://eslint.nuxt.com/)
- 首頁沒有功能長列表、testimonial、blog feed 或第二組 CTA；內容在 package chooser 後結束，再接 footer。[首頁](https://eslint.nuxt.com/)

### Current main source

- 首頁 route 是獨立 `pages/index.vue`，hero 的 `Get Started` 明確連到 `/packages/module`，sections 由 landing content 逐筆渲染成 cards。[index.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/index.vue#L48-L123)
- 首頁文字與三張 package cards 都放在 `content/index.yml`；該檔同時設定 `navigation: false`，避免首頁進入 docs navigation。[index.yml](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/content/index.yml#L1-L21)

## 3. Docs sidebar、active state 與頁內 TOC

### Live UI

- 左側 sidebar 分成 `Packages`、`Guide`、`Legacy Packages`：Packages 有 Module／Config／Plugin；Guide 有 FAQ／Migration；Legacy Packages 有兩個舊 config 頁。[Module](https://eslint.nuxt.com/packages/module)
- 當前頁有雙層視覺 active state：top navigation 的所在區域變成綠色 `text-primary`；sidebar 當前 link 同時為綠色、較粗，並帶左側 current-color border。[Module](https://eslint.nuxt.com/packages/module)；[FAQ](https://eslint.nuxt.com/guide/faq)
- 實際 DOM 中這些 current links 沒有 `aria-current`；active state 是 CSS class 所表達的視覺狀態。[Module](https://eslint.nuxt.com/packages/module)；[FAQ](https://eslint.nuxt.com/guide/faq)
- 桌面右側 `Table of Contents` 直接列當頁 headings；Module 頁從 Features 到 Auto-Init，底部再接 Community links。[Module](https://eslint.nuxt.com/packages/module)

### Current main source

- `app.vue` 取得 content navigation 並 provide；docs layout inject 後交給 `mapContentNavigation`／`UNavigationTree`，沒有自建 sidebar record component。[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L30-L38)；[docs layout](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/layouts/docs.vue#L1-L16)
- Packages 與 Guide 分組 metadata 各只有 title 與 icon。[Packages index](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/content/1.packages/index.yml#L1-L2)；[Guide index](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/content/2.guide/index.yml#L1-L2)
- catch-all route 使用 docs layout、render content body，並在 `page.body.toc.links` 存在時才建立右側 `UContentToc`；底部 Community links 也是 TOC slot 的一部分。[catch-all page](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/%5B...slug%5D.vue#L1-L19)；[catch-all page](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/%5B...slug%5D.vue#L70-L113)

## 4. FAQ 的內容分組、互動與深連結

### Live UI

- FAQ 只有兩個內容 headings：`What to use?` 與 `Package Disambiguation`；前者用段落回答 package 選擇，後者用表格比較 packages 與 tags。[FAQ](https://eslint.nuxt.com/guide/faq)
- 兩題都是普通 H3，不是 accordion；DOM 沒有 `details`，也沒有屬於 FAQ 題目的 disclosure buttons。[FAQ](https://eslint.nuxt.com/guide/faq)
- headings 具有 `what-to-use`、`package-disambiguation` IDs，右側 TOC 提供 `#what-to-use` 與 `#package-disambiguation` 深連結。[FAQ](https://eslint.nuxt.com/guide/faq)
- Live 表格包含三個現行 packages、一列 `Legacy packages:` 分隔，以及四個 legacy／deprecated packages。[FAQ](https://eslint.nuxt.com/guide/faq)

### Current main source

- main SHA 的 Markdown 仍只有相同兩個 H3，並用一般 Markdown table；沒有 accordion component syntax。[FAQ source](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/content/2.guide/0.faq.md#L1-L24)
- 但 current main table 只留下 `@nuxt/eslint`、`@nuxt/eslint-config`、`@nuxt/eslint-plugin` 三列，已沒有 live 的 legacy rows。[FAQ source](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/content/2.guide/0.faq.md#L24-L30)

## 5. Light、dark 與 system theme

### Live UI

- Landing page 固定 dark：實測 `<html>` class 是 `dark`，背景 `rgb(15, 23, 42)`、文字 `rgb(226, 232, 240)`，且沒有 theme button。[首頁](https://eslint.nuxt.com/)
- Docs page 預設也是 dark，但 header 與 footer各有 `Switch to light mode` button；切換後 `<html>` 變成 `light`，背景 `rgb(255, 255, 255)`、文字 `rgb(51, 65, 85)`，button 文案改成 `Switch to dark mode`。[Module](https://eslint.nuxt.com/packages/module)
- 可見 UI 是 light／dark 二態按鈕，沒有可見 `System` 選項或三態 selector；因此只能確認 system theme **未暴露為可見控制項**，不能推論底層完全不支援 system preference。[Module](https://eslint.nuxt.com/packages/module)

### Current main source

- Nuxt config 設 `colorMode.preference: 'dark'`；landing page 又以 page meta 強制 `colorMode: 'dark'`。[nuxt.config.ts](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/nuxt.config.ts#L27-L29)；[index.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/index.vue#L1-L5)
- `UColorModeButton` 只在 `$colorMode.forced` 為 false 時渲染，解釋了首頁無按鈕、docs 有按鈕。[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L40-L55)
- UI primary 是 green、gray palette 是 slate；light/dark background 與 foreground variables 分別指定 white／gray-700 與 gray-950／gray-200。[app.config.ts](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.config.ts#L1-L27)
- landing 額外用一個固定、模糊的綠色 radial gradient 作背景氣氛，cards 則使用深色漸層。[index.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/index.vue#L105-L119)；[index.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/index.vue#L126-L145)

## 6. Desktop／mobile navigation

### Live UI 實測

- 1440×900：header 顯示 Documentation／FAQ／Releases；docs 同時顯示左 sidebar 與右 TOC。[Module](https://eslint.nuxt.com/packages/module)
- 390×844：header 只保留 logo、GitHub icon 與 `Open Menu`；原本桌面 top links 隱藏。[首頁](https://eslint.nuxt.com/)；[Module](https://eslint.nuxt.com/packages/module)
- 在 docs 開啟 menu 後，panel 顯示搜尋入口與 Packages／Guide／Legacy Packages navigation；右側 TOC 則獨立縮成 `Table of Contents` 按鈕。[Module](https://eslint.nuxt.com/packages/module)
- 在 landing 開啟 menu 後，只顯示 Documentation／FAQ／Releases，沒有 docs sidebar tree 或搜尋。[首頁](https://eslint.nuxt.com/)

### Current main source

- mobile docs panel 被 `$route.path !== '/'` 條件包住，所以首頁不注入 search/tree，其他 routes 才注入。[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L57-L71)

## 7. Current main 的 Nuxt Content、路由、layout 與 navigation 實作

- Workspace catalog 宣告 `@nuxt/content: ^3.15.2`，lockfile 實際解析為 `3.15.2`；這足以確認依賴世代為 Nuxt Content 3。[pnpm-workspace.yaml](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/pnpm-workspace.yaml#L58-L68)；[pnpm-lock.yaml](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/pnpm-lock.yaml#L53-L55)
- `docs/nuxt.config.ts` extends `@nuxt/ui-pro`，並註冊 `@nuxt/content`、`@nuxt/ui` 等 modules。[nuxt.config.ts](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/nuxt.config.ts#L1-L13)
- 該 SHA 的 docs tree 沒有自訂 `content.config.ts`；內容以數字排序資料夾、Markdown 與 group `index.yml` 組成。[docs tree](https://github.com/nuxt/eslint/tree/07aebbced575c549bba37f20d6e980b5696597ea/docs)
- 首頁由獨立 `pages/index.vue` 查詢 `/` content；其餘內容由 `pages/[...slug].vue` catch-all route 處理。[index.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/index.vue#L20-L22)；[catch-all page](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/%5B...slug%5D.vue#L1-L19)
- 雖然 dependency 是 Content 3.15.2，main source 仍實際呼叫 `queryContent`、`fetchContentNavigation`、`serverQueryContent`，並讀取 `_extension`、`_file` 等欄位。此研究只陳述目前 identifiers，不把它判定成另一個 Content 版本。[index.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/index.vue#L20-L22)；[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L30-L35)；[catch-all page](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/%5B...slug%5D.vue#L7-L17)；[search endpoint](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/server/api/search.json.get.ts#L1-L5)
- 全域 shell 在 `app.vue` 組合 Header、NuxtLayout／NuxtPage、Footer、Search；`layouts/docs.vue` 只加 docs 的 main container 與左 sidebar；catch-all page 再組 PageHeader、ContentRenderer、surround navigation、右 TOC。[app.vue](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/app.vue#L40-L115)；[docs layout](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/layouts/docs.vue#L5-L22)；[catch-all page](https://github.com/nuxt/eslint/blob/07aebbced575c549bba37f20d6e980b5696597ea/docs/pages/%5B...slug%5D.vue#L70-L113)

## 來源與限制

- UI 行為只引用 `eslint.nuxt.com` live 頁面；source facts 只引用 `github.com/nuxt/eslint` 的 commit-pinned files。
- Responsive 觀察使用 1440×900 與 390×844，僅記錄實際可見／展開後可見項目。
- 沒有把 current main source 視為 live deployment 的精確快照；FAQ 差異已逐項列明。
