# 官方文件網站資訊架構比較

研究日期：2026-08-15

## 結論

四個網站共同採用的核心不是「複雜資料模型」，而是三層導航：**文件區域 → 主題頁面 → 頁內章節**。內容量大的網站用 sidebar 拆成多個 URL；內容量小的套件則把主要說明放在一個長頁面，只把 FAQ、Migration 等不同使用意圖另開頁面。

對 `nuxt-content-mermaid` 這種單一用途、低維護人力的 Nuxt 附屬套件，最合適的基線接近 **Nuxt ESLint 的混合式架構**，而不是 Nuxt Content 的大型分類樹，也不應照 Kinde 把所有主題塞成單一極長頁。建議以少量手寫 Markdown 頁面形成一個 docs 區域，由 sidebar 導覽；tabs 只拿來切換互斥的程式碼變體，例如套件管理器，不用來承載主要主題。

## 心智模型：三層導覽各自解決不同問題

| 層級 | 回答的問題 | 合適元件 |
| --- | --- | --- |
| 文件區域 | 我現在在網站哪一區？ | top nav |
| 主題頁面 | 我要讀安裝、設定還是疑難排解？ | sidebar、多個 Markdown 路由 |
| 頁內章節 | 這一頁裡我要找哪個小節？ | heading anchors、頁內 TOC |

四個官方網站都可以用這個模型解釋；差異只在第二層要拆多少頁，而不是是否需要 records、projection 或驗證管線。

## 比較摘要

| 網站 | 內容尺度 | 主題切割 | 單頁長度 | 適合借鏡之處 |
| --- | --- | --- | --- | --- |
| Nuxt SEO / AI Ready | 中大型模組文件 | 多頁；Getting Started、Core Concepts、Advanced，另有 API、Releases | 中等 | sidebar 分主題、頁內 TOC、安裝指令 tabs |
| Nuxt Content | 大型平台文件 | 大量多頁；依概念、檔案類型、工具、部署、進階能力分類 | 中短為主，Configuration 較長 | 大規模資訊分類的上限案例 |
| Nuxt ESLint | 小型套件群 | Module 主頁集中說明；FAQ、Migration 獨立 | 長 | 最接近小型 Nuxt 套件的務實基線 |
| Kinde Nuxt module | 大型產品中的單一 SDK | Nuxt module 幾乎全部集中在單頁 | 非常長 | 顯示「單一頁面塞到底」的閱讀成本 |

## 1. Nuxt SEO / AI Ready

### 全站與 sidebar

- 全站 top nav 提供 Modules、Tools、Pro、Learn SEO、Releases；進入 AI Ready 後，還有 User Guides、API、Releases 這一層產品內導覽。[AI Ready Installation](https://nuxtseo.com/docs/ai-ready/getting-started/installation)
- 文件 sidebar 依 Getting Started、Core Concepts、Advanced 分組；Introduction、Installation、Markdown Conversion、MCP、CLI、i18n、Cloudflare Deployment 等主題各自有 URL，而不是同頁 tabs。[AI Ready Installation](https://nuxtseo.com/docs/ai-ready/getting-started/installation)
- 因此它是明確的多頁文件：sidebar 負責切主題，頁面本身只承載一個使用目標。

### 單頁內容與元件

- Installation 頁依 Setup Module、Verifying Installation、Configuration、Next Steps 排列，桌面版右側有對應的頁內 TOC。[AI Ready Installation](https://nuxtseo.com/docs/ai-ready/getting-started/installation)
- 安裝指令用 `nuxt`、`npm`、`yarn`、`pnpm`、`bun` tabs 表達同一動作的互斥變體；補充條件用 callout，渲染模式差異用表格。這些元件服務內容，而不是成為內容的資料模型。[AI Ready Installation](https://nuxtseo.com/docs/ai-ready/getting-started/installation)
- 安裝、API、Release 是不同入口；核心能力再拆成個別 guides。此站未在已觀察的 AI Ready sidebar 中提供獨立 Troubleshooting 頁，因此不應推測它另有完整疑難排解架構。[AI Ready Installation](https://nuxtseo.com/docs/ai-ready/getting-started/installation)

### 桌面／行動導覽觀察

- 在 1440×900 觀察時，左側文件 sidebar 與右側頁內 TOC 同時可見。[AI Ready Installation](https://nuxtseo.com/docs/ai-ready/getting-started/installation)
- 在 390×844 觀察時，全站導覽縮成 `Open menu`，產品 sidebar 縮成 `Open AI Ready Navigation Menu`；展開後才顯示 Getting Started、Core Concepts、Advanced。桌面右側的頁內 TOC 未顯示。[AI Ready Installation](https://nuxtseo.com/docs/ai-ready/getting-started/installation)

## 2. Nuxt Content

### 全站與 sidebar

- top nav 將 Documentation 與 Studio、Templates、Blog 分開；docs sidebar 再以 Getting Started、Collections、Files、Query Utils、Components、Deploy、Integrations、Advanced 分組。[Nuxt Content Getting Started](https://content.nuxt.com/docs/getting-started)
- Getting Started 自身就拆成 Introduction、Installation、Configuration、Migration；Query Utils 與 Components 則幾乎是一個 API／component 一頁，Deploy 也按 Server、Static、Cloudflare、Vercel、Netlify 等目標拆頁。[Nuxt Content Getting Started](https://content.nuxt.com/docs/getting-started)
- Debugging tools 放在 Advanced 分組內，表示疑難排解是在資訊架構中可獨立尋找的主題，而不是每個設定項目的附屬欄位。[Nuxt Content Getting Started](https://content.nuxt.com/docs/getting-started)

### 單頁內容與元件

- Installation 頁是一條完整首次成功路徑：安裝套件、註冊 module、自動設定、建立第一個 collection、建立 Markdown、顯示頁面；同一行為的 package manager 變體用 code tabs。[Nuxt Content Installation](https://content.nuxt.com/docs/getting-started/installation)
- Configuration 雖然獨立成一頁，仍用 `build`、`markdown`、`database`、`renderer`、`watch`、`experimental` 等 heading 分組，並在細項使用 Default／Signature tabs；這是一般手寫 API 內容，不是每個 option 對應一個 Vue record 元件。[Nuxt Content Configuration](https://content.nuxt.com/docs/getting-started/configuration)
- 各頁桌面版都有 `On this page` TOC，以 heading anchors 定位當頁內容。[Nuxt Content Getting Started](https://content.nuxt.com/docs/getting-started)

### 桌面／行動導覽觀察

- 在 1440×900 觀察時，完整 docs sidebar 與 `On this page` 同時可見。[Nuxt Content Getting Started](https://content.nuxt.com/docs/getting-started)
- 在 390×844 觀察時，固定 sidebar 不再顯示，頁內 TOC 收斂為 `On this page` 按鈕。此次觀察未能從可見控制項確認完整 docs sidebar 的行動版開啟方式，因此不推測其互動。[Nuxt Content Getting Started](https://content.nuxt.com/docs/getting-started)

## 3. Nuxt ESLint

### 全站與 sidebar

- sidebar 只有三個主要分組：Packages、Guide、Legacy Packages。Packages 對應 Module、Config、Plugin；Guide 只有 FAQ、Migration Guide，規模遠小於 Nuxt Content。[ESLint Module](https://eslint.nuxt.com/packages/module)
- Module 沒有再拆出 Installation、Configuration、Recipes 或 API 路由，而是在單一頁面依 Features、Quick Setup、Manual Setup、Recipes 與多個設定主題往下排列。[ESLint Module](https://eslint.nuxt.com/packages/module)
- FAQ 和 Migration 因為分別回答「如何選擇套件／常見問題」與「如何從舊套件遷移」這兩種獨立意圖，所以另開頁面。[FAQ](https://eslint.nuxt.com/guide/faq)；[Migration Guide](https://eslint.nuxt.com/guide/migration)

### 單頁內容與元件

- Module 頁同時包含安裝、手動設定、VS Code、NPM Scripts、Prettier、Stylistic、config customization、checker、preset、auto-init；右側 Table of Contents 提供所有 heading 的頁內跳轉。[ESLint Module](https://eslint.nuxt.com/packages/module)
- 套件管理器以 `yarn`、`npm`、`pnpm`、`bun` 切換按鈕呈現；其用途仍然只是同一安裝步驟的程式碼變體。[ESLint Module](https://eslint.nuxt.com/packages/module)
- 已觀察頁面沒有獨立 Options/API 頁，設定說明直接與使用情境並列。這是「少量頁面、直接寫內容」的典型案例。[ESLint Module](https://eslint.nuxt.com/packages/module)

### 桌面／行動導覽觀察

- 在 1440×900 觀察時，左側 Packages／Guide／Legacy Packages 與右側 Table of Contents 同時可見。[ESLint Module](https://eslint.nuxt.com/packages/module)
- 在 390×844 觀察時，全站／sidebar 導覽縮成 `Open Menu`，頁內 TOC 縮成 `Table of Contents` 按鈕。[ESLint Module](https://eslint.nuxt.com/packages/module)

## 4. Kinde Nuxt module

### 全站與 sidebar

- Kinde 是大型產品文件站：top nav 有 SDKs、APIs，主 sidebar 還涵蓋 Get started、Build on Kinde、SDKs and APIs、Auth and access、Billing 等大量產品領域；Nuxt module 只是 Back end SDKs 下的一頁。[Kinde Nuxt module](https://docs.kinde.com/developer-tools/sdks/backend/nuxt-module/)
- 在 Nuxt module 這一層沒有再拆子頁；安裝到進階使用全部集中在同一 URL。[Kinde Nuxt module](https://docs.kinde.com/developer-tools/sdks/backend/nuxt-module/)

### 單頁內容與元件

- 頁面從 Supported versions、Register、Install、Integrate、callback URL、environment、login、redirect、route protection，一路延伸到 permissions、feature flags、user information、organizations、health check、Management API，桌面 `On this page` 有近二十個主要 anchors。[Kinde Nuxt module](https://docs.kinde.com/developer-tools/sdks/backend/nuxt-module/)
- package manager 使用 `npm`、`pnpm`、`yarn`、`bun` tablist；其餘內容主要是 heading、段落、步驟清單、程式碼區塊，以及行內 Tip／Note。[Kinde Nuxt module](https://docs.kinde.com/developer-tools/sdks/backend/nuxt-module/)
- 這證明單頁可以承載完整 SDK，但也直接產生非常長的閱讀面與 TOC；它比較適合作為「不要讓單頁繼續增長到這個程度」的上限案例。

### 桌面／行動導覽觀察

- 在 1440×900 觀察時，大型全站 sidebar、內容區與 `On this page` 同時存在。[Kinde Nuxt module](https://docs.kinde.com/developer-tools/sdks/backend/nuxt-module/)
- 在 390×844 的一次觀察中，header 提供 `Menu` 按鈕；由於後續重載未能穩定重現相同 responsive 狀態，行動版 menu 展開內容與頁內 TOC 行為標記為**未驗證**，不作進一步推論。[Kinde Nuxt module](https://docs.kinde.com/developer-tools/sdks/backend/nuxt-module/)

## 對 `nuxt-content-mermaid` 的結構含意

### 1. sidebar 應切「使用者任務」，不是資料種類

四站的 sidebar 名稱都是 Installation、Configuration、Recipes、FAQ、Migration、Deploy 等使用者可理解的任務或領域，沒有把文件內容稱為 Record。對本套件而言，`ConfigurationRecord`、`AuthoringRecord`、`DelegatedRecord` 是內部資料處理語彙，不是讀者的心智模型。

### 2. 主題導覽用 sidebar／頁面，互斥變體才用 tabs

四站明確可觀察到的 tabs 幾乎都用於 package manager 或 Default／Signature 等互斥視圖。沒有任何樣本用 tabs 承擔整套安裝、設定、疑難排解的主要資訊架構。因此，如果「單一網頁」是指同一 docs 區域，可以用 sidebar；如果是指同一 URL 再以 tabs 隱藏多個主題，則沒有從這四站得到支持。

### 3. 建議採 3–5 個手寫 Markdown 頁面

可先用以下最小結構，再依本 repo 實際內容盤點調整：

```text
Docs
├─ Getting Started     # 安裝、第一張圖、最短成功路徑
├─ Usage               # Markdown 寫法、theme／rendering 等常見操作
├─ Configuration       # 只解釋本套件真正擁有的設定
├─ Mermaid Options     # 一段繼承邊界說明＋導向 Mermaid 官方文件
└─ Troubleshooting     # 只有真的出現常見問題時才保留
```

這個方案比 Nuxt ESLint多不了多少頁，卻避免 Kinde 式超長單頁。每頁只需要 frontmatter、headings、paragraphs、lists、code blocks、必要的 callout；不需要 `records.v1.json`、公開 projection、每種 record 的 Vue component 或專屬驗證腳本。

### 4. `ReferenceDelegatedRecord` 應消失，而不是改名

「完全繼承 Mermaid」不是一種需要逐筆呈現的文件 entity，而是一個 ownership boundary。最直接的內容是：本套件只文件化自己擁有的 options；其餘 Mermaid configuration 原樣傳遞，並提供官方文件連結。這與四個樣本普遍採用的「本頁說自己的範圍，外部能力導向 owner 文件」一致。

### 5. 維護複雜度上限

建議把網站架構的長期維護面限制為：

- 一個共用 docs layout；
- 一份 sidebar navigation 設定，或直接從內容檔案順序產生；
- 3–5 個 Markdown／MDC 檔；
- 只有確實跨頁重複、且 Markdown primitives 無法清楚表達時，才新增共用元件；
- tabs、callouts、code groups 優先使用現成文件主題能力，不建立 Reference 專屬元件層。

## 來源範圍與限制

- 僅使用使用者指定的四個第一方網站，以及同站內理解架構所必要的頁面。
- 未使用二手文章、GitHub source tree 或其他網站作為證據。
- Responsive 觀察採 1440×900 與 390×844；只有實際可見且可重現的控制項才記錄。Kinde 行動版不穩定重現的部分已明確標註未驗證。
