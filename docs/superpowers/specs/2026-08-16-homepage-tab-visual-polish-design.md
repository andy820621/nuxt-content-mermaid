# 首頁 Demo Tab 視覺優化設計

**日期：** 2026-08-16  
**狀態：** 已核准  
**範圍：** Documentation website 首頁的 Markdown／Rendered UI tabs

## 摘要

首頁 demo tabs 採用 `Outline icon + underline` 方向。現有 `MD`／`UI` 實心文字徽章改為單色 outline SVG；active state 不再依賴整塊 pill 背景，而是同時使用 accent 文字、較高字重與 3px underline。暗色主題在 underline 上加入非常輕微的 glow，讓選取狀態不必依賴低對比背景也能辨識。

本次只改變 tab 的視覺 presentation，不改變 tab 名稱、狀態模型、ARIA、鍵盤操作、預設選取項目或內容 render path。

## Mental model

這組控制是 editor／code group 的 view switcher，不是兩顆主要操作按鈕：

- icon 用來快速區分「原始 Markdown 文件」與「實際 UI 輸出」；
- label 承擔完整語意；
- underline 表示目前開啟的 view；
- focus outline 表示鍵盤焦點，必須和 active state 保持不同。

因此 icon 不應成為獨立色塊，active 也不應看起來像 elevated button。

## Icon contract

兩個 tab 使用 18px、`currentColor`、無填色的 inline SVG：

- `Markdown`：文件外框、折角與 code brackets。
- `Rendered UI`：browser window 外框、頂部 chrome 與簡化 UI lines。

SVG 設為 `aria-hidden="true"`，accessible name 仍完全來自可見 label。Icon 與 label 共用 inactive、hover 與 active 顏色。

不新增 icon dependency，也不為兩個 glyph 建立通用 icon component。SVG 留在 `LandingMermaidDemo.vue` 的 tab markup 內；tabs data 只需要保留判斷 glyph 的穩定 `id` 與 label。

## State contract

### Inactive

- 文字與 icon 使用 `var(--muted)`。
- 字重維持目前一般 tab 權重。
- 背景透明。

### Hover

- 只對 inactive tab 顯示輕微 surface background。
- 文字提高到 `var(--text)`，但不出現 underline。
- Active tab hover 不改變其 selected hierarchy。

### Active

- 文字與 icon 使用 `var(--accent-strong)`。
- 字重提高，讓 active 不只依靠顏色。
- Button 底部使用 3px `var(--accent)` underline，左右各保留少量內縮。
- 可在 tab 底部使用極淡 accent fade，但不得形成完整 pill 或高對比背景塊。
- 暗色主題的 underline 加入低強度 glow；light theme 不需要 glow。

### Focus

- 沿用全站 `:focus-visible` accent outline。
- Focus outline 表示操作焦點，active underline 表示選取狀態；兩者可以同時出現。
- Outer surface 的 clipping 不得截斷可見 focus indicator。

## Layout contract

- 保留目前 tab header、trigger padding、可點擊範圍與水平捲動行為。
- Icon 與文字間距約 0.5rem，icon 不應改變 tab 高度。
- 兩個 label 在 320px viewport 仍需同時可理解；若內容寬度超出，維持 tablist 自身的水平捲動，頁面本身不得水平溢出。
- Source／preview panels 的尺寸與切換行為不變。

## Component boundary

`LandingMermaidDemo.vue` 仍負責：

- tab data 與 active state；
- mouse／keyboard selection；
- tab／tabpanel ARIA relationships；
- Markdown source 與真實 transport preview。

本次只替換 tab trigger 內的 visual glyph markup。CSS 移除 `.landing-demo__tab-badge`，新增 `.landing-demo__tab-icon` 與 active underline pseudo-element。不得修改 transport props、source reconstruction 或 Mermaid rendering。

## Verification

自動驗證必須確認：

- 既有首頁 browser tests 繼續通過；
- 每個 tab 仍只有一個可見 label 與正確 accessible name；
- default active tab、click switching、Arrow／Home／End keyboard behavior 不變；
- 320px viewport 沒有 page-level horizontal overflow；
- website static generation、root lint、tests 與 type tests 通過。

人工視覺驗證必須涵蓋：

- light／dark theme；
- `Markdown` 與 `Rendered UI` 各自 active；
- mouse hover、keyboard focus 與 active＋focus 同時存在；
- 1280px、768px 與 320px viewport；
- dark active underline、文字及 icon 能一眼區分 inactive tab，但 glow 不搶過內容。

## 非目標

- 改變 tab labels 或預設 active tab。
- 新增 tab animation、sliding indicator 或 motion dependency。
- 新增 icon library 或通用 icon abstraction。
- 改變 demo frame、hero typography、diagram source、renderer、toolbar、theme state 或 responsive breakpoints。
- 將這組 tab style 推廣成全站通用 component。
