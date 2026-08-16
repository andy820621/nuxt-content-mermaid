# Task 1：Persistent color mode 報告

## 結論

Documentation Website 已改由 `@nuxtjs/color-mode` 擁有 `html[data-theme]` 與 localStorage 偏好設定。`useWebsiteTheme` 只處理網站切換動作、400ms 圓形 View Transition 與 fallback；app shell 不再寫入 `data-theme` 或呼叫 `setMermaidTheme()`。未變更套件公開 API，亦未觸及 Task 2 的 ThemeToggle、Reka tooltip 或最終圖示元件。

## RED → GREEN 證據

每個 RED 都在對應 slice 的行為實作缺席時執行，確認失敗是可觀察的 DOM／localStorage／Mermaid SVG／瀏覽器 API 結果，而非私有實作。

| Slice | RED 證據 | GREEN 命令與結果 |
| --- | --- | --- |
| 系統深色初始狀態 | `pnpm --dir website test test/siteControls.e2e.test.ts`：`expected 'light' to be 'dark'`。 | 同一命令：1 passed。 |
| 手動切換 persistence | 同一命令：點擊後 `expected 'light' to be 'dark'`。 | 同一命令：2 passed；驗證 `nuxt-content-mermaid-color-mode` 為 `dark` 並在 reload 後保留。 |
| Mermaid SVG 重繪 | `pnpm --dir website test test/siteControls.e2e.test.ts -t 'redraws the Mermaid SVG'`：`expected false to be true`。 | 同一命令：1 passed（其餘 2 skipped）；驗證 `.mermaid-block .mermaid > svg` 外部 SVG 已變更。 |
| 一般 View Transition 與點擊原點 | `... -t 'reveals the selected mode'`：`expected 0 to be 1`（未呼叫 `document.startViewTransition`）。 | 同一命令：1 passed；驗證 400ms、`::view-transition-new(root)` 與 click-origin `circle(0px at xpx ypx)`。 |
| reduced motion | `... -t 'reduced motion'`：`expected 1 to be 0`（不應啟用 View Transition）。 | 同一命令：1 passed；偏好 reduced motion 時仍切成 dark。 |
| API 缺失 fallback | `... -t 'View Transition API is unavailable'`：`expected 'light' to be 'dark'`。 | 同一命令：1 passed。 |
| API rejection fallback | `... -t 'view transition rejects'`：`expected 'light' to be 'dark'`。 | 同一命令：1 passed。 |
| 重複切換鎖定 | `... -t 'ignores repeated toggles'`：第二次切換使 DOM 回到 light，`expected 'light' to be 'dark'`。 | 同一命令：1 passed；transition 未完成時只接受第一次切換。 |

## 變更檔案

- `pnpm-workspace.yaml`：新增 catalog 版本 `@nuxt/icon` 2.5.0。
- `pnpm-lock.yaml`：由 `pnpm install` 更新依賴鎖定。
- `website/package.json`：新增 `@nuxt/icon`、`@nuxtjs/color-mode`。
- `website/nuxt.config.ts`：啟用兩個 Nuxt module；color mode 使用 `system`、`dataValue: 'theme'`、storage key `nuxt-content-mermaid-color-mode`。
- `website/composables/useWebsiteTheme.ts`：新增公開於網站內部的 `WebsiteThemeController`，處理切換、原點／中心／最遠角半徑、400ms View Transition、reduced motion、API 缺失／rejection 與重複切換鎖定。
- `website/app.vue`：保留既有 inline button markup，改用 `useWebsiteTheme`，並移除 app shell 對 `data-theme`、`setMermaidTheme()` 的控制。
- `website/test/siteControls.e2e.test.ts`：新增 8 個使用 DOM、ARIA、localStorage 與 Mermaid SVG seam 的 browser 行為測試。

## 最終驗證

- `pnpm install`：通過；僅有既有 peer dependency warnings。
- `pnpm lint --fix`：通過。
- `pnpm --dir website test test/siteControls.e2e.test.ts`：1 file、8 tests passed。
- `pnpm test -- --reporter=dot`：45 files、425 tests passed。
- `pnpm test:types`：通過。首次執行因 `playground/.nuxt` 在安裝後未重新產生，`queryCollection()` collection type 變成 `never`；執行 `pnpm --dir playground exec nuxi prepare` 重新生成後通過，未修改 playground 原始碼。

## Self-review

- `git diff --check` 通過。
- app shell 僅從 controller 讀取 active theme；沒有 `data-theme` 寫入或 `setMermaidTheme` 呼叫。
- color-mode 保留 `data-theme` 供既有 CSS 使用，並以指定 key 寫入 localStorage。
- View Transition 不可用、reduced motion 與 reject 三條路徑皆直接套用新偏好，不阻塞切換。
- 變更限於網站設定、網站 composable、網站測試與必要依賴；沒有修改 `src/`、套件公開 API 或 Task 2 元件。

## Concern

提交前另行啟動的完整 `pnpm --dir website test` 被使用者中斷，因此沒有該命令的最終結果；Task 1 narrow suite、根目錄完整測試與型別檢查皆已通過。
