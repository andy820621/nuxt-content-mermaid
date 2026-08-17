# Nuxt 生態系文件網站首頁模式研究

> 研究日期：2026-08-17  
> 範圍：Nuxt UI、Nuxt Content、Nuxt ESLint、Nuxt Image、Nuxt SEO，另以 Nuxt Scripts 補充比較  
> 來源限制：只採官方 live homepage 與官方 GitHub repository；版面觀察以 1440 × 1400 桌面 viewport 實際載入首頁確認

## 結論先行

**建議完整刪除目前 hero 後的 01／02／03 三張卡，不要原樣保留，也不建議只做視覺美化。**

首頁的基本任務只有三個：讓訪客知道產品是什麼、相信它真的能解決問題、知道下一步怎麼做。目前 hero 已用真實 Mermaid source／rendered UI 切換完成前兩項，並用 `Get started` 完成第三項；三張卡只是把相同訊息再說一次，沒有增加新的證據、導覽選擇或可執行動作。[目前首頁結構](../../website/pages/index.vue)、[hero demo 實作](../../website/components/LandingMermaidDemo.vue)、[首頁內容來源](../../website/content/1.index.md)

Nuxt 生態系的代表性首頁也支持這個判斷：

- Nuxt UI、Nuxt Content 會列功能，但使用緊湊、低視覺權重的 feature list；真正的大面積留給 component previews、code pair、video 等產品證據。[Nuxt UI 首頁](https://ui.nuxt.com/)、[Nuxt Content 首頁](https://content.nuxt.com/)
- Nuxt ESLint 的三張大卡不是通用賣點，而是三個不同 package 的文件入口；首頁在 package chooser 後就結束。[Nuxt ESLint 首頁](https://eslint.nuxt.com/)、[首頁內容原始碼](https://github.com/nuxt/eslint/blob/main/docs/content/index.yml#L1-L21)
- Nuxt Image、Nuxt SEO、Nuxt Scripts 都先給安裝指令、模組清單、支援服務 logo 等可驗證資訊，再展開功能或結果。[Nuxt Image 首頁](https://image.nuxt.com/)、[Nuxt SEO 首頁](https://nuxtseo.com/)、[Nuxt Scripts 首頁](https://scripts.nuxt.com/)

若刪除後仍希望提高轉換率，唯一值得優先補上的不是另一個 section，而是把現有安裝命令做成 hero 內的可複製次要動作：`pnpm add @barzhsieh/nuxt-content-mermaid @nuxt/content`。這是實際下一步，不是另一段行銷敘述。[Getting Started](../../website/content/2.getting-started.md)

## 判斷模型：每個首頁區塊必須改變一個決策

從第一原理看，文件網站首頁不是功能清單，而是一段很短的決策流程：

1. **理解**：這是什麼、適合誰。
2. **相信**：輸入、輸出或結果是否真的存在。
3. **行動**：現在可以安裝、試用或去哪一頁。

因此，一個大面積區塊至少應具備下列一種角色：

- **Proof**：真實 demo、code、install command、產品截圖、使用者／整合生態證據。
- **Choice**：把訪客導向彼此不同的 package、component、template 或使用情境。
- **Action**：讓訪客直接開始安裝、閱讀或試用。

只有抽象 benefit、而且已被 hero 或 demo 表達過的內容，不應取得大卡片的視覺權重。以下比較以此模型檢查各站 hero 後第一個可見區塊，而非只比較卡片外觀。

## 橫向比較

| 網站 | Hero 的主要證據與 CTA | Hero 後第一個可見內容 | 通用 feature cards？ | 資訊密度與角色 |
| --- | --- | --- | --- | --- |
| **Nuxt UI** | 左側定位、`Get started`、`Explore components`；右側用大量實際 component previews 呈現產品。CTA 下另有 Tailwind、Reka UI、TypeScript 三個緊湊信任訊號。[首頁](https://ui.nuxt.com/)、[hero 內容](https://github.com/nuxt/ui/blob/v4/docs/content/index.yml#L1-L27)、[hero 版型](https://github.com/nuxt/ui/blob/v4/docs/app/pages/index.vue#L64-L162) | Hero 後才是六項 capability grid：modern web、icons、fonts、color mode、i18n、typography。[功能內容](https://github.com/nuxt/ui/blob/v4/docs/content/index.yml#L28-L52)、[版型](https://github.com/nuxt/ui/blob/v4/docs/app/pages/index.vue#L166-L206) | 有功能列表，但不是有序的大卡；圖示、短標題、短說明與連結採三欄緊湊排列。[首頁](https://ui.nuxt.com/) | 高密度 hero；「產品實物」先於功能總結。後續較大的 section 才用 code examples、template thumbnails 深入證明。[內容原始碼](https://github.com/nuxt/ui/blob/v4/docs/content/index.yml#L53-L260) |
| **Nuxt Content** | Hero 右側直接並列 `content/index.md` 與 `pages/index.vue`，展示 Markdown／MDC 輸入及 `queryCollection`、`ContentRenderer` 使用方式；同時有 `Get Started` 與可複製的 `npx nuxt module add content`。[首頁](https://content.nuxt.com/)、[hero 原始碼](https://github.com/nuxt/content/blob/main/docs/content/index.md#L9-L76) | 緊接九項 capability：File-based CMS、Query Builder、SQLite、Markdown with Vue、code highlighting、Visual Editor、navigation、Prose Components、deploy everywhere。[功能原始碼](https://github.com/nuxt/content/blob/main/docs/content/index.md#L78-L181) | 有，但使用無厚重大邊框的緊湊 feature grid；真正的大區塊留給 source／preview／video。[首頁](https://content.nuxt.com/)、[後續 proof 原始碼](https://github.com/nuxt/content/blob/main/docs/content/index.md#L184-L460) | 很高；順序是「先看懂怎麼運作 → 快速掃描能力 → 深入證明」。 |
| **Nuxt ESLint** | 極短 hero：產品定位、簡述、唯一 primary CTA `Get Started`。[首頁](https://eslint.nuxt.com/)、[內容原始碼](https://github.com/nuxt/eslint/blob/main/docs/content/index.yml#L1-L6) | `Packages`，三張卡分別導向 Nuxt Module、ESLint Config、ESLint Plugin。[首頁](https://eslint.nuxt.com/)、[package routes](https://github.com/nuxt/eslint/blob/main/docs/content/index.yml#L7-L21) | 表面上是三張大卡，但它們是三個不同資訊架構入口，不是三個通用 benefit。 | 很低；沒有 install command、demo、長功能列表或第二組 CTA，package chooser 後即結束。[首頁](https://eslint.nuxt.com/) |
| **Nuxt Image** | Hero 除了 `Get started`，直接提供可複製的 `npx nuxt module add image`，右側用圖片轉換視覺解釋產品。[首頁](https://image.nuxt.com/)、[首頁原始碼](https://github.com/nuxt/image/blob/main/docs/content/index.md#L19-L37) | 第一層不是功能卡，而是 OpenAI、Sephora、Hyundai、GitLab、Emma logo 的 `Trusted by` 社會證明；再下一層才是六項 dynamic features。[首頁](https://image.nuxt.com/)、[首頁原始碼](https://github.com/nuxt/image/blob/main/docs/content/index.md#L39-L64) | 有六張可點擊 feature cards，但前面已先完成 action 與 trust proof，且每張導向具體使用／provider 文件。[首頁](https://image.nuxt.com/) | 中等；install action 與 trust proof 的層級高於 feature summary。 |
| **Nuxt SEO** | Hero 右側是一個 terminal-style module inventory：安裝命令以及 Robots、Sitemap、OG Image、Schema.org、Link Checker、SEO Utils 等狀態；左側有 `Get Started`、`Install Nuxt SEO`、`See your SEO in Pro` 三個不同去向。[首頁](https://nuxtseo.com/) | 直接進入編號的結果旅程：先是 `Help crawlers find the right pages`，同時展示對應 modules 與具體能力，再依序處理 bot context、搜尋結果、維運與 AEO。[首頁](https://nuxtseo.com/) | 使用卡與編號，但編號代表工作流程／結果階段，卡片代表不同 modules；不是三張同義的產品賣點。 | 很高；每一層都把抽象 SEO 結果綁到可安裝模組、功能細節或工具。 |
| **Nuxt Scripts** | Hero 左側是定位、`Get started`、`Star on GitHub`；右側以大量第三方服務 logo 與 `Explore integrations in 3D` 證明支援範圍。[首頁](https://scripts.nuxt.com/)、[官方 repository](https://github.com/nuxt/scripts) | 三項 benefit：Better Web Vitals、Privacy for your users、Secure third-parties。[首頁](https://scripts.nuxt.com/) | 這是樣本中最接近「三個通用賣點」的案例，但它們沒有序號、厚重邊框或大卡留白；三項也分別對應效能、隱私、安全三個獨立風險。 | 中等；通用 benefits 被降權，且 hero 已先用 integrations 實物建立證據，後續很快進入 API、facade components、consent 與 live embed demos。[首頁](https://scripts.nuxt.com/) |

## 各站值得借用的做法

### Nuxt UI：讓實物主導首屏

**事實。** Nuxt UI 把 component previews 放在 hero 的右半部，且 hero 自身高度遠大於三個緊湊的信任訊號；下一個 feature grid 才做能力掃描。[首頁](https://ui.nuxt.com/)、[版型原始碼](https://github.com/nuxt/ui/blob/v4/docs/app/pages/index.vue#L64-L206)

**推論。** 本專案的 Mermaid rendered preview 就是相同類型的「產品實物」。既然它已在 hero，下一層不必再用大卡解釋「可以寫 diagram、可以 render diagram」。

### Nuxt Content：先展示 input → output，再列能力

**事實。** Nuxt Content 把 Markdown source、Vue page code、install command 放在第一屏；九個 features 雖多，視覺權重仍低於 code proof。[首頁](https://content.nuxt.com/)、[首頁原始碼](https://github.com/nuxt/content/blob/main/docs/content/index.md#L9-L181)

**推論。** 這是本專案最接近的參考物：產品同樣處理 Nuxt Content 中的 authoring source 與 rendered result。本專案已經具備 source／preview tabs，應強化這個 proof，而不是在下方複述它。

### Nuxt ESLint：內容少不是缺陷

**事實。** Nuxt ESLint 的首頁只有 hero 與 package chooser；沒有為了讓頁面變長而補通用 features。[首頁](https://eslint.nuxt.com/)、[完整首頁內容](https://github.com/nuxt/eslint/blob/main/docs/content/index.yml#L1-L21)

**推論。** 如果刪除三卡後首頁只剩一個完成度高的 hero，也符合正式 Nuxt 生態系先例。小而單一目的的 module，不必仿照平台型產品建立長 landing page。

### Nuxt Image：把「能開始」放在「更多賣點」之前

**事實。** Nuxt Image 在 hero 直接提供安裝命令，hero 後先放 trusted-by logos，再進功能卡。[首頁](https://image.nuxt.com/)、[首頁原始碼](https://github.com/nuxt/image/blob/main/docs/content/index.md#L19-L64)

**推論。** 若本專案需要補一項首頁資訊，安裝 command 的決策價值高於 `Keep the source readable`。前者能立刻推動採用；後者較適合 progressive enhancement／fallback 文件。

### Nuxt SEO：編號必須真的代表順序

**事實。** Nuxt SEO 使用 1、2、3… 組織 crawler discovery、bot context、search result、post-launch health 等連續工作階段，並把每一階段連到不同 modules。[首頁](https://nuxtseo.com/)

**推論。** 本專案的 `01 / 02 / 03` 看似流程，但三張卡其實混合 authoring 方式、rendered capability 與 fallback benefit；序號創造了不存在的步驟關係，應一併移除。

### Nuxt Scripts：三個 benefit 只有在彼此獨立時才成立

**事實。** Nuxt Scripts 的三項 benefit 分別處理 performance、privacy、security，hero 則先用支援服務 logo 證明整合範圍；三項 benefit 本身不使用卡框或編號。[首頁](https://scripts.nuxt.com/)

**推論。** 即使決定保留三點，也應先通過「是否是三個不同風險／工作」的測試。`Write diagrams` 與 `Render diagrams` 是同一條 input → output 鏈，並非兩個獨立價值面向。

## 跨站模式

### 可觀察事實

1. **Proof 普遍早於完整 feature list。** Nuxt UI 用 component previews，Nuxt Content 用 source／Vue code，Nuxt Image 用 install command 與 transformation visual，Nuxt SEO 用 module terminal，Nuxt Scripts 用 integrations logo。[Nuxt UI](https://ui.nuxt.com/)、[Nuxt Content](https://content.nuxt.com/)、[Nuxt Image](https://image.nuxt.com/)、[Nuxt SEO](https://nuxtseo.com/)、[Nuxt Scripts](https://scripts.nuxt.com/)
2. **大型卡片通常代表可點擊的實體或分流。** Nuxt ESLint 是 packages，Nuxt Image 是具體使用文件，Nuxt SEO 是 modules；純 capability 在 Nuxt UI／Content 則被壓成緊湊 grid。[Nuxt ESLint](https://eslint.nuxt.com/)、[Nuxt Image](https://image.nuxt.com/)、[Nuxt SEO](https://nuxtseo.com/)、[Nuxt UI](https://ui.nuxt.com/)、[Nuxt Content](https://content.nuxt.com/)
3. **CTA 數量跟可區分的下一步一致。** 單一 module 的 Nuxt ESLint 只留一個主要 CTA；Nuxt UI 的兩個 CTA 分別是開始安裝與探索 components；Nuxt SEO 的三個 CTA 分別導向文件、安裝與付費產品。[Nuxt ESLint](https://eslint.nuxt.com/)、[Nuxt UI](https://ui.nuxt.com/)、[Nuxt SEO](https://nuxtseo.com/)
4. **首頁長度跟產品表面積成比例。** ESLint package chooser 很短；UI、Content、SEO、Scripts 有 components、editor、modules 或 integrations 可展示，因此首頁較長。[Nuxt ESLint](https://eslint.nuxt.com/)、[Nuxt UI](https://ui.nuxt.com/)、[Nuxt Content](https://content.nuxt.com/)、[Nuxt SEO](https://nuxtseo.com/)、[Nuxt Scripts](https://scripts.nuxt.com/)

### 設計推論

跨站共同原則不是「Nuxt 首頁都要有 feature cards」，而是：**視覺權重應等於資訊增量。** 通用 feature list 可以存在，但只有在它補充了新的能力地圖時才值得保留，而且通常低於 demo、code、install 或 route choice。

## 對目前 01／02／03 的逐項判斷

目前三項內容來自 landing i18n，並以三張同尺寸、帶 `01 / 02 / 03` 的大卡呈現。[英文內容](../../website/i18n/locales/en.json)、[首頁版型](../../website/pages/index.vue)

| 現有項目 | 判斷 | 理由 |
| --- | --- | --- |
| `Write diagrams in Markdown` | **刪除卡片** | Hero 的 `Markdown` tab 已直接顯示 Mermaid fence；實物比敘述更有說服力。[hero demo](../../website/components/LandingMermaidDemo.vue) |
| `Render interactive diagrams` | **刪除卡片** | Hero 預設就是 `Rendered UI`，已呈現 interactive、theme-aware output；卡片只是替畫面加旁白。[hero demo](../../website/components/LandingMermaidDemo.vue)、[首頁 diagram source](../../website/content/1.index.md) |
| `Keep the source readable` | **移出首頁主層級** | 這是 fallback／progressive enhancement 細節，不是多數首次訪客採用 module 的首要決策；若需要保留，應進文件或作為 demo 的輔助註記，而不是第三張等權卡。 |

三張卡還有兩個結構問題：

- `01 / 02 / 03` 暗示連續步驟，但內容實際上是兩個同一路徑的階段加一個 fallback benefit；序號語意不成立。
- 卡片尺寸、邊框與留白把低資訊增量內容提升成 hero 後最重要區塊，造成「看起來生硬」的根因。問題不只是 CSS，而是資訊層級與視覺權重不一致。

## 建議的新首頁順序

### 首選方案：刪除，不另建 section

1. Header／navigation。
2. 現有雙欄 hero：左側定位、description、`Get started`；右側 source／rendered demo。
3. Footer。

Hero 已完整回答理解、相信、行動三件事，因此這個短首頁是完整狀態，不是缺內容。刪除卡片後若畫面顯得空，應調整 hero 的下方 spacing 或整體垂直節奏，而不是再填入低價值文案。

### 可選增強：把 install command 併入 hero

若產品目標更重視安裝轉換，可在 `Get started` 附近放一個可複製的次要 control：

```bash
pnpm add @barzhsieh/nuxt-content-mermaid @nuxt/content
```

命令應直接沿用 Getting Started 的唯一來源，避免首頁另有一份安裝事實。[Getting Started](../../website/content/2.getting-started.md)

這個做法同時借用 Nuxt Content 與 Nuxt Image 的模式：讓「下一步」出現在 hero，而不是另加一個大 section。[Nuxt Content](https://content.nuxt.com/)、[Nuxt Image](https://image.nuxt.com/)

### 不推薦的折衷：重做三張卡

若有既定需求必須保留 feature summary，最低限度應：

- 移除 `01 / 02 / 03`；
- 改成無厚重卡框的緊湊 inline list；
- 每項只保留一行，並連到不同的具體文件；
- 不再重述 demo 已可直接看見的 input／output。

但這仍弱於直接刪除，因為目前沒有三個足夠獨立的首頁級決策。

## 最終判斷

**刪除 01／02／03 是資訊設計修正，不是內容削減。**

Nuxt 生態系沒有要求套件首頁必須出現三張 feature cards；代表性網站真正一致的是「先證明、再分流、最後才補充能力」。本專案已經把最有價值的 proof 做進 hero，下一步應讓它成為唯一主角。若要再加東西，只加能立即執行的 install command；不要保留一個沒有新增決策價值的中介區塊。
