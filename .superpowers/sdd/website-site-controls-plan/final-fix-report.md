# Whole-branch Final Fix Report：Website Site Controls

## 結果

以 `60bb586` 為基線，只修正 final review 的兩個 Important findings：雙向 View Transition 的可見 snapshot 動畫契約，以及 generated static website 的五個 site-control icons 離線交付。兩個 finding 都完成 root cause → RED → single fix → GREEN；Documentation Website 的公開 route、locale 與 Nuxt Content Mermaid package API 均未變更。

最終 production 行為：

- target dark 保留既有 old-over-new stacking，動畫 `::view-transition-old(root)` 的 radius→0。
- target light 保留既有 new-over-old stacking，動畫 `::view-transition-new(root)` 的 0→radius。
- root snapshots 的 UA 預設 opacity animation 已停用。
- 五個已知 icons 全部進入 `@nuxt/icon` client bundle，static runtime provider 設為 `none`；不需要重複設定 `fallbackToApi: false`。
- generated static browser 在封鎖外部 Iconify API 且沒有 `/api/_nuxt_icon` 的條件下，五個 icons 都具有非零尺寸與實際 SVG data mask/background 或 inline SVG content。

## Finding 1：雙向 View Transition

### Root cause

`website/assets/css/main.css` 的方向 stacking 已明確規定：light 目標狀態是 new(2) > old(1)，dark 目標狀態是 old(2) > new(1)。但 `useWebsiteTheme()` 不分方向固定動畫 `::view-transition-new(root)` 的 0→radius，因此 target dark 動畫位於不透明 old snapshot 下方。兩個 root snapshots 同時保留瀏覽器 UA 的預設 fade animation，會與圓形 reveal 疊加。

### RED

Covering seam：`website/test/siteControls.e2e.test.ts` 的 browser-observable `Element.animate()` pseudo-element/keyframes，與同一 animation 時點的 pseudo-element computed stacking/animation name。

命令：

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run test/siteControls.e2e.test.ts -t "animates the visible root snapshot in both theme directions"
```

修正前結果：exit 1；1 failed／16 skipped。target dark 實收 `::view-transition-new(root)`，預期 `::view-transition-old(root)`，精準命中 review finding。

### Single fix

- toggle 開始時先固定 `targetTheme`。
- target dark 選 old snapshot 與 radius→0；target light 選 new snapshot 與 0→radius。
- CSS 對 `::view-transition-old(root)` 與 `::view-transition-new(root)` 設 `animation: none`；既有 z-index 規則不變。

### GREEN

同一命令最終結果：exit 0；1 passed／16 skipped，13.17s。測試同時覆蓋兩個方向的 pseudo-element、keyframe 順序、400ms duration、點擊原點、stacking 與 `animation-name: none`。

## Finding 2：Generated Static Offline Icons

### Root cause

五個 icon 名稱沒有進入 `@nuxt/icon` client bundle。ThemeToggle 由 `ColorScheme` client-side render，LocaleSwitcher 的 generated HTML 則只有空的 language icon span；static preset 沒有可用的 `/api/_nuxt_icon` runtime endpoint，預設 provider 會嘗試 runtime Iconify fallback。修正前 exact generate 對 `material-symbols-light:language` 產生六次 prerender failure 與一次彙總 warning。

本機 `@nuxt/icon@2.5.0` 文件確認：

- `clientBundle.icons` 是已知 icon 的明確預載機制。
- `provider: 'none'` 會完全關閉 dynamic icon fetching，適合 static offline 契約。
- provider 已為 `none` 時，再加 `fallbackToApi: false` 沒有額外效果，因此未加入。

### RED

Covering seam：新增 `website/test/generatedSite.e2e.test.ts`，在 production `NODE_ENV` 執行 exact Nuxt generate，serve `.output/public`，以 Playwright 封鎖所有非本地 request 與 `/api/_nuxt_icon`，再驗證 render output，而非只驗證 icon class。

命令：

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run test/generatedSite.e2e.test.ts
```

修正前結果：exit 1；2 failed。

- generate output 含精確 warning：``[Icon] failed to load icon `material-symbols-light:language` ``。
- offline browser 的第一個 site-control icon 為 0×0 空 span，沒有 inline SVG 或有效 data-URI mask/background。

獨立 baseline：

```bash
pnpm --filter nuxt-content-mermaid-website exec nuxt generate
```

結果：exit 0，但有六次 material language icon load failure 與一次 repeated-summary warning；generated `/index.html` 的 language icon 是無繪製資料的空 span。

### Single fix

在 `website/nuxt.config.ts` 設定：

- `icon.provider: 'none'`
- `icon.clientBundle.icons` 明列：
  - `line-md:sunny-outline`
  - `line-md:moon`
  - `line-md:sunny-outline-twotone-loop`
  - `line-md:moon-twotone`
  - `material-symbols-light:language`

### GREEN

同一 generated-static test 命令最終結果：exit 0；2 passed，9.27s。測試在 light 與 dark 切換後逐一驗證五個 icons，且 blocked external/API request ledger 為空陣列。

## 完整驗證

| 命令 | Exit | 結果 |
|---|---:|---|
| `pnpm --filter nuxt-content-mermaid-website exec nuxt prepare` | 0 | 產生 website types；client bundle 為 5 icons／5.85KB uncompressed。 |
| `pnpm exec vue-tsc -p website/tsconfig.json --noEmit` | 0 | 無 diagnostics。 |
| 雙向 transition narrow（上列命令） | 0 | 1 passed／16 skipped。 |
| generated static offline icon check（上列命令） | 0 | 2 passed。 |
| `pnpm --filter nuxt-content-mermaid-website exec vitest run test/siteControls.e2e.test.ts` | 0 | 最終重跑 17 passed，17.14s。 |
| `pnpm --filter nuxt-content-mermaid-website exec nuxt generate` | 0 | 29 routes prerendered；5-icon client bundle；沒有 material icon load failure。 |
| `pnpm --filter nuxt-content-mermaid-website exec vitest run` | 0 | 4 files／28 tests passed，39.64s。 |
| `pnpm lint` | 0 | ESLint 無 diagnostics。 |
| `git diff --check` | 0 | 無 whitespace errors。 |

## 變更檔案

- `website/composables/useWebsiteTheme.ts`：target-aware pseudo-element 與 keyframes。
- `website/assets/css/main.css`：停用 root snapshot 預設 animation，保留既有 stacking。
- `website/nuxt.config.ts`：五個 icon 的 offline client bundle 與 `provider: 'none'`。
- `website/test/siteControls.e2e.test.ts`：雙向 transition browser regression test。
- `website/test/generatedSite.e2e.test.ts`：production generate warning 與 generated static offline rendering regression test。
- `.superpowers/sdd/website-site-controls-plan/final-fix-report.md`：本報告。

## Warnings / Concerns

- `siteControls` 完整檔第一次驗證時，既有 persistence case 在 click 返回後立即讀取 `data-theme`，曾得到 light；該 case 單獨重跑 1/1 通過，完整檔重跑 17/17 通過，website full suite 28/28 通過。為避免擴大 scope，未修改該既有 test timing；保留為非決定性風險。
- Nuxt/Vitest 仍輸出既有 Nitro/h3 unused-import warning；exact generate 仍有既有 >500KB chunk warning。兩者都不含 material icon failure，也不屬於本 wave scope。
- 已刪除本 wave 的 `.playwright-mcp/page-*.yml` 與 console log；未建立或提交 `.playwright-cli` artifacts。
- 全程未終止或修改使用者既有 Nuxt dev process。
