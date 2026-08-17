# Website 控制列視覺校正設計

## 目標

以最小變更改善 website header 的三個細節：語系切換器只顯示目標語系文字、主題圖示與 GitHub 圖示具有接近的視覺重量，以及 GitHub 連結在新分頁開啟。

## 設計決策

### 語系切換器

- 保留既有 `NuxtLink + switchLocalePath()`、tooltip、`title` 與 `aria-label` 行為。
- 移除 language icon，只顯示目標語系 `中` 或 `EN`。
- 將 pill 版面改為單欄文字配置，保留既有 hit area、色彩與圓角語言。
- 從 `@nuxt/icon` client bundle 移除不再使用的 `material-symbols-light:language`。

### 主題圖示

- 保留 2.5rem 圓形按鈕 hit area、Line MD 靜態／動畫圖示與 View Transition 行為。
- 主題 glyph box 從 1.25rem 放大至 1.4rem；GitHub inline SVG 維持 1.25rem。
- 這是 optical sizing：Line MD 月亮與太陽的圖形留白比實心 GitHub mark 多，因此需要較大的外框才能呈現接近的視覺大小。
- 此比例沿用 Portfolio 的策略；Portfolio 對一般 icon 使用約 1.3rem，主題 icon 使用 1.4em。

### GitHub 外部連結

- 保留原本 URL、標題與無障礙名稱。
- 新增 `target="_blank"` 與 `rel="noopener noreferrer"`。

## 測試與驗收

- 語系切換器在英文與中文頁仍導向正確 locale route，只顯示 `中`／`EN`，且沒有 Iconify 子節點。
- 主題圖示的 rendered box 大於 GitHub SVG box，分別維持 1.4rem 與 1.25rem，避免依賴螢幕截圖比較。
- GitHub 連結具有 `_blank` target 與 `noopener noreferrer` rel。
- Generated static test 改為驗證剩餘四個主題圖示皆可離線繪製，不再期待 language icon。
- 既有主題切換、語系路由、tooltip、320px overflow 與 generate 驗證保持通過。

## 非目標

- 不更換 GitHub inline SVG。
- 不改變主題或語系狀態管理。
- 不加入新的 icon collection、元件抽象或視覺截圖測試。
