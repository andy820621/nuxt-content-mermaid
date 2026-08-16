# Task 4 Report：修正測試型別與初始狀態隔離

## 結果

Task 4 已完成。15 個 Task 2 View Transition mock 型別診斷已由 RED 轉為 GREEN；landing hero 與 site controls 的 browser state、color scheme、storage、transition stub 及 hydration 時序已隔離。未修改 website 或 package 的 production behavior／公開 API。

完整驗證最終全數通過。執行期間發現並以測試層修正兩個 determinism 問題：Nuxt Content SQLite 的跨 test-file teardown race，以及 landing hero keyboard test 在 Nuxt hydration 前送出事件的 race。

## RED / GREEN

### RED：website typecheck

命令：

```bash
pnpm exec vue-tsc -p website/tsconfig.json --noEmit
```

初始結果：exit 2，共 15 個 diagnostics，全部位於 `website/test/siteControls.e2e.test.ts`。

- TS2322：4 個。測試重宣告的簡化 `startViewTransition` mock 無法同時滿足 TypeScript 5.9.3 `lib.dom.d.ts` 的原生 `Document.startViewTransition(): ViewTransition`。
- TS2349 / TS2722：6 個。交集 overload 使 callback 被推斷為 callback、options 或 undefined 的 union，不能直接呼叫。
- TS2352：5 個。`window` 被直接斷言為含必要 test-only 欄位的型別，與原始 `Window` 缺少足夠重疊。

Root cause：TypeScript 5.9.3 已內建完整 View Transition API；測試以交集型別覆寫同名原生方法，形成不相容 overload。這是 test typing 問題，不是 production API bug。

最小修正：

- 以 `Object.defineProperty(document, 'startViewTransition', ...)` 安裝 browser-boundary stub，保留測試需要的 `ready`／`finished` 行為，不要求假物件偽裝成完整原生 `ViewTransition`。
- test-only `window` 欄位改為 optional，讀取時加入明確 runtime guard。

GREEN：同一命令 exit 0，無輸出、0 diagnostics；在完整驗證序列第 5 步再次 exit 0。

### RED / GREEN：SQLite 競爭

完整 website suite 初次執行：

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run
```

結果：exit 1。3 個 test files、27 個 tests 本身通過，但 Vitest 捕捉 1 個 unhandled rejection：`SqliteError: no such table: _content_info`，stack 指向 Nuxt Content `dropContentTables`。

證據：

- `landingHero.e2e.test.ts` 與 `siteControls.e2e.test.ts` 都以相同 `websiteRoot` 呼叫 Nuxt test-utils `setup()`。
- Vitest 預設 `fileParallelism: true`。
- Nuxt Content teardown 先列出 `_content_%` tables，再逐一執行不含 `IF EXISTS` 的 `DROP TABLE`；並行 teardown 可在列出與刪除之間互相移除 table。
- 聚焦單檔 `siteControls` 18 tests 通過；完整雙 e2e files 並行才出現錯誤。
- 使用者既有 Nuxt dev process（PID 6901／16647）保持運行；未終止或修改該 process。

單一變因驗證：

```bash
pnpm --filter nuxt-content-mermaid-website exec vitest run --no-file-parallelism
```

結果：exit 0，3 files／27 tests 通過。據此新增 test-only `website/vitest.config.ts`，設定 `fileParallelism: false`。原始 exact command 最終 exit 0，且未再出現 SQLite error。

### RED / GREEN：landing keyboard hydration

在 SQLite 修正後重跑完整 website suite，曾出現 1 個 test failure：

- case：`supports Arrow, Home, and End keyboard navigation`
- symptom：送出 `ArrowLeft` 後，Markdown tab 的 `aria-selected` 仍為 `false`。

Root cause：keyboard 行為由 `LandingMermaidDemo.vue` 的 Vue `@keydown` handler 提供；Nuxt test-utils 只有在 `page.goto(..., { waitUntil: 'hydration' })` 時才等待 Nuxt hydration。原測試只等待 browser load，因此事件可能在 handler attach 前送出。

最小修正：landing hero 六個 navigation 全部等待 `hydration`，保留原有 tab、keyboard、overflow、雙 theme、中文頁與 navigation assertions。

GREEN：聚焦 `landingHero.e2e.test.ts` exit 0（1 file／6 tests）；完整 website suite exit 0（3 files／27 tests）。

## 狀態隔離

### `landingHero.e2e.test.ts`

- 每個 page 以 `createPage(undefined, { colorScheme: 'light', storageState: { cookies: [], origins: [] } })` 建立獨立 light browser context。
- 每個 page 在首次 navigation 前安裝 init script，清除 `nuxt-content-mermaid-color-mode`。
- 所有 navigation 等待 Nuxt hydration，避免 keyboard 與互動事件早於 app code。

### `siteControls.e2e.test.ts`

- 每個 case 透過 `createSiteControlsPage()` 建立獨立、空 storage、預設 light 的 browser context。
- system dark/light 與 reduced-motion 在首次 app navigation 前由 `emulateMedia()` 設定。
- persistence case 在自己的 context 寫入 storage，再於同一 context reload；不會被其他 case 或 init script 清除。
- View Transition unavailable、reject、reduced-motion、animation log 與 pending transition stubs 都安裝在各自 page/context，不會跨 case 污染。

## 完整驗證序列

| # | 命令 | Exit | 結果 |
|---|---|---:|---|
| 1 | `pnpm dev:prepare` | 0 | module stub、root `.nuxt` 與 playground types 生成成功。 |
| 2 | `pnpm test:types` | 0 | root 與 playground `vue-tsc` 通過。 |
| 3 | `pnpm prepack` | 0 | package build 成功，dist 233 kB。 |
| 4 | `pnpm --filter nuxt-content-mermaid-website exec nuxt prepare` | 0 | website types 生成成功；辨識 2 個本地 icon collections。 |
| 5 | `pnpm exec vue-tsc -p website/tsconfig.json --noEmit` | 0 | 0 diagnostics。 |
| 6 | `pnpm --filter nuxt-content-mermaid-website exec vitest run test/siteControls.e2e.test.ts` | 0 | 1 file／18 tests 通過，50.02s。 |
| 7 | `pnpm --filter nuxt-content-mermaid-website exec vitest run` | 0 | 最終 3 files／27 tests 通過，83.28s。初次執行的 SQLite race 與一次 hydration race 如上記錄並修正。 |
| 8 | `pnpm --filter nuxt-content-mermaid-website exec nuxt generate` | 0 | 29 routes prerendered，static output 生成成功。 |
| 9 | `pnpm lint --fix` | 0 | ESLint fix run 通過，無 diagnostics。 |
| 10 | `pnpm lint` | 0 | ESLint 通過，無 diagnostics。 |
| 11 | `pnpm test` | 0 | 45 files／425 tests 通過，112.09s。 |
| 12 | `git diff --check` | 0 | 無 whitespace errors。 |

額外聚焦證據：

- exact website `vue-tsc` 修正後多次 exit 0。
- `siteControls.e2e.test.ts`：18/18 通過。
- `landingHero.e2e.test.ts`：6/6 通過。
- `vitest run --no-file-parallelism` root-cause probe：27/27 通過。

## Warnings

- `pnpm prepack`：`MermaidThemeMode` 與 `SimpleMermaidTheme` 在 `src/types/mermaid.d.ts` 被匯入但未使用；build 成功。此 warning 不屬於 Task 4，未修改 production types。
- website Vitest／generate：Nuxt Nitro server bundle 報告 h3 的 `H3Error`／`H3Event` 等 imports 未使用；tests/build 成功。
- `nuxt generate`：一個 minified client chunk 超過 500 kB；未影響 generate。
- `nuxt generate`：`material-symbols-light:language` prerender 時載入失敗，最終彙總重複 6 次；generate 仍成功。
- root `pnpm test`：部分 fixtures 未提供 Content config，Nuxt Content 使用 default collection；另有 Nitro/h3 unused-import warnings。425 tests 全數通過。

## 變更檔案

- `website/test/landingHero.e2e.test.ts`：light/storage context isolation 與 hydration waits。
- `website/test/siteControls.e2e.test.ts`：獨立 browser state、型別正確的 View Transition stubs、test log guards。
- `website/vitest.config.ts`：序列執行 website test files，避免共享 Nuxt Content SQLite teardown race。
- `.superpowers/sdd/website-site-controls-plan/task-4-report.md`：本報告。

## Self-review

- [x] 先以 exact website `vue-tsc` 重現 15 個 diagnostics，再最小修正 test typings。
- [x] 未修改 Nuxt Content Mermaid 公開 API、runtime implementation 或 website production behavior。
- [x] landing hero 每個 browser context 明確固定 light，且 storage 在 app code 前由 init script 清除。
- [x] site controls 的 system dark、persistence、reduced-motion 與 transition stubs 使用獨立 context；persistence reload 不會被清除。
- [x] 保留原有 tab、overflow、雙 theme、中文頁、locale navigation、tooltip 與 header assertions。
- [x] 未新增 screenshot 或 pixel diff。
- [x] SQLite race 先收集 process、open-handle、Nuxt Content teardown 與 Vitest parallelism 證據，再採用 test-only serialization。
- [x] 未終止使用者既有 Nuxt dev process。
- [x] brief 12 條命令依序執行；失敗停在原步驟 root-cause、修正並重跑後才繼續。
- [x] 最終 lint、types、website tests、generate、root tests 與 diff check 全數成功。

## Concerns

- Website test files 現在刻意序列執行，完整 suite 約 83 秒；這是避免同 root Nuxt Content SQLite lifecycle 競爭的可靠性／速度取捨。
- 上述 build、icon 與 upstream unused-import warnings 仍存在，但沒有導致本 Task 驗證失敗，且不應透過 production 行為變更來掩蓋。
