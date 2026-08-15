# Documentation Website

## 狀態

本規格是 2026-08-15 核准的文件網站產品與架構契約；實作尚未開始。

本規格取代先前以 Canonical Package Documentation、Structured Reference、Contract Demo、Stable Artifact、Website Synchronization 與部署阻擋驗證為核心的網站設計。那些概念不再是網站需求，也不得以其他名稱重新引入。

## 決策摘要

文件網站是一個小型、內容驅動的 Nuxt Content 3 應用程式。它的責任只有讓套件使用者閱讀手寫文件，不負責證明套件、artifact、release 或部署的正確性。

最終資料流固定為：

```text
手寫 Markdown
→ Nuxt Content page collection
→ queryCollection() / queryCollectionNavigation()
→ pages/[...slug].vue
→ 通用 docs layout
→ 左側 sidebar + 中央 ContentRenderer + 右側頁內 TOC
```

網站可以留在 pnpm workspace，讓本機開發直接解析 workspace 套件；這只是相依套件安裝方式，不形成 root、CI、artifact 或 release contract。

## 第一原理

這個網站只有三種必要資訊：

1. 使用者現在正在閱讀哪一頁。
2. 還有哪些文件主題可以前往。
3. 當前頁面有哪些 heading 可以跳轉。

Nuxt Content 3 已經分別提供 page collection、`queryCollectionNavigation()` 與 Markdown TOC。網站不需要第二份內容資料庫、record taxonomy、投影層、生成器或 parity verifier。

## 目標

- 讓一人維護者主要透過新增或修改 Markdown 維護網站。
- 讓每個主要使用者任務擁有獨立 URL，避免單頁過長。
- 以內容檔案的路徑與排序決定 sidebar，不在 Vue 程式碼重複維護選單。
- 以 Markdown heading 自動形成右側頁內 TOC。
- 只描述本套件擁有的設定；Mermaid 擁有的設定以簡短邊界說明及官方連結處理。
- 讓網站完全退出套件品質與交付流程。

## 非目標

以下能力不屬於本網站：

- Nuxt UI Pro 或其他文件站框架。
- Nuxt Studio。
- 搜尋 API、全文搜尋索引或搜尋完整性承諾。
- Plausible 或其他 analytics。
- OG Image 生成。
- 自訂行銷 landing page 或 Contract Demo。
- Packages、Guide、Legacy 等多層產品分類。
- 認證、個人化、request-time API 或 server-side content service。
- 多版本文件、同步翻譯或文件發佈策略。
- Reference records，或以 YAML、JSON、TypeScript、frontmatter、資料 collection 等形式建立的替代 records 模型。
- 文件與程式碼的 parity、freshness、schema、artifact 或 release 驗證。

## Nuxt Content 3 架構

### 版本與 API 邊界

目前 workspace 解析 `@nuxt/content` 3.15.2。這是設計時的本機基準，不是網站另行建立的固定版本契約。

實作只使用 Nuxt Content 3 的公開 API：

- `defineCollection()` 與 `defineContentConfig()`。
- `queryCollection()`。
- `queryCollectionNavigation()`。
- `ContentRenderer`。
- page document 的 `body.toc.links`。
- 必要時使用標準 `.navigation.yml`。

不得使用 Content 2 的 `queryContent()`、`fetchContentNavigation()`、`useContent()`、`index.yml` 或 document-driven mode。

### Collection

網站只有一個 `docs` page collection：

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

`type: 'page'` 使用 Nuxt Content 內建的 `path`、`title`、`description`、`body` 與 `navigation` 欄位。網站不擴充 Zod schema，不保留 `pageId`，也不建立 data collection。

`source: '**'` 讓 collection 同時容納 Markdown 與未來可能需要的 `.navigation.yml`。初始內容樹不需要 `.navigation.yml`；若日後加入，它只能描述標準的目錄導覽 metadata，不得承載套件設定或其他 Reference facts。

### 單一內容路由

`website/pages/[...slug].vue` 是唯一內容 page：

- 使用 `queryCollection('docs').path(route.path).first()` 讀取當前文件。
- 使用 `queryCollectionNavigation('docs')` 讀取官方 navigation tree。
- 找不到文件時回傳 404。
- 使用文件內建的 `title` 與 `description` 設定基本頁面 metadata。
- 將 page 與 navigation 傳入 `layouts/docs.vue`。
- 在 layout 的中央欄位以 `ContentRenderer` 渲染 page。

不得為 Overview、Getting Started、Configuration 等主題建立各自的 Vue page wrapper。

### 通用 docs layout

`website/layouts/docs.vue` 只負責共用閱讀介面：

- Header：套件名稱與回到 Overview 的連結。
- 左側 sidebar：由 `queryCollectionNavigation()` 的結果渲染。
- 中央內容：由 catch-all page 傳入的 `ContentRenderer`。
- 右側 TOC：由當前 page 的 `body.toc.links` 渲染。
- 小螢幕：三欄收斂為單欄，sidebar 位於內容前，TOC 可隱藏；不新增 JavaScript drawer state。

為保留既有 `/migration/v3` 路徑，navigation tree 會包含一個只有路徑用途的 migration directory。Layout 只列出具有文件 path 的 leaf items，因此 sidebar 仍呈現六個直接主題，不顯示額外的 Migration 分類層。這只是官方 navigation tree 的即時呈現，不會被儲存、生成或驗證成另一份模型。

### 導覽與排序

檔名前綴決定順序；Nuxt Content 會從產生的 URL 移除數字前綴。Sidebar 不含手寫 route array。

右側 TOC 完全來自 Markdown 的 H2/H3 heading。頁面不另外維護 anchor registry、TOC JSON 或 Reference section list。

## 最終內容樹

```text
website/content/
├── 1.index.md                       # /                    — Overview
├── 2.getting-started.md             # /getting-started     — Getting Started
├── 3.writing-diagrams.md            # /writing-diagrams    — Writing Diagrams
├── 4.configuration.md               # /configuration       — Configuration
├── 5.troubleshooting.md              # /troubleshooting      — Troubleshooting
└── 6.migration/
    └── 1.v3.md                       # /migration/v3         — Migration to v3
```

每個檔案只使用 Nuxt Content 內建 frontmatter，例如 `title`、`description` 與必要時的 `navigation`。不得加入 record ID、artifact version、evidence、ownership taxonomy 或生成指令。

### 各頁責任

| 頁面 | 唯一責任 |
| --- | --- |
| Overview | 簡短說明套件用途、適用前提與下一步；不含自訂 landing component。 |
| Getting Started | 安裝、註冊 module、第一個 Mermaid fence 與成功結果。 |
| Writing Diagrams | Markdown fence、`<Mermaid>` component、title、display mode、page/per-diagram Mermaid 設定與優先序。 |
| Configuration | 只說明套件擁有的 module/runtime/per-diagram options，以及一段 Mermaid 原生設定邊界。 |
| Troubleshooting | 依可觀察症狀整理常見失敗與處理方式。 |
| Migration to v3 | 保留 v2 到 v3 的必要遷移資訊，包括已廢棄或無效的舊名稱。 |

`/reference` 及其內容不保留，也不建立 redirect。設定文件的正式入口改為 `/configuration`。

## 最少必要的網站程式檔案

最終網站只有以下非內容程式檔案：

```text
website/
├── app.vue
├── assets/css/main.css
├── content.config.ts
├── layouts/docs.vue
├── nuxt.config.ts
├── package.json
├── pages/[...slug].vue
└── tsconfig.json
```

責任如下：

| 檔案 | 責任 |
| --- | --- |
| `app.vue` | 只渲染 `NuxtPage`。 |
| `content.config.ts` | 定義唯一的 `docs` page collection。 |
| `pages/[...slug].vue` | 查詢當前 page 與 navigation、處理 404/metadata、呼叫通用 layout 與 `ContentRenderer`。 |
| `layouts/docs.vue` | Header、sidebar、中央 slot、右側 TOC 與響應式結構。 |
| `nuxt.config.ts` | 註冊 Nuxt Content、本套件與一份 CSS；不註冊 virtual module、生成器或驗證器。 |
| `assets/css/main.css` | 文件閱讀介面的基本排版與 responsive CSS。 |
| `package.json` | 私有本機網站的 `dev`/`generate` 指令與必要 runtime dependencies。 |
| `tsconfig.json` | Nuxt 專案的標準 TypeScript 設定。 |

初始設計不需要 `website/components/`、`website/utils/`、`website/reference/`、`website/server/` 或網站專用 scripts/tests。

## `records.v1.json` 內容遷移

### 遷移原則

`records.v1.json` 只作為這次人工改寫的來源，之後永久刪除。不是每個 record 都要變成一段文件；只保留會改變套件使用方式的資訊。

保留並改寫成一般 Markdown 的資訊：

- 公開設定 path。
- 使用目的。
- 使用者需要知道的 type 或 accepted shape。
- 實際 default。
- module、runtime 與 per-diagram 的實用優先序。
- 最小使用範例。
- 會影響使用方式的限制或 deprecation。

### 改寫進 Configuration

10 個 `configuration-group` records 不再是內容實體，只轉化為以下 Markdown headings：

- General。
- Loading and Mermaid initialization。
- Theme。
- Custom components。
- Expand。
- Toolbar。

23 個 `configuration-value` records 的使用者資訊依下列方式處理：

| Configuration 區段 | 改寫的設定 |
| --- | --- |
| General | `enabled`、`debug`。 |
| Loading | `loader.lazy` 的 boolean/object 行為、`loader.lazy.threshold`，以及 `loader.init` 會傳給 Mermaid 的邊界。 |
| Theme | `theme.light`、`theme.dark`。 |
| Custom components | `components.renderer`、`components.spinner`、`components.error`。 |
| Expand | `expand.enabled`、`expand.margin`、`expand.invokeOpenOn.diagramClick`、`expand.invokeCloseOn.esc`、`wheel`、`swipe`、`overlayClick`、`closeButtonClick`。 |
| Toolbar | `toolbar.title`、`toolbar.fontSize`、`toolbar.fullscreenToolbarScale`、`toolbar.buttons.copy`、`fullscreen`、`expand`。 |

`theme.useColorModeTheme` 是 accepted no-op，不放進主要 Configuration 選項表；它只在 Migration to v3 以一句遷移提醒保留。

`delegated.loader-init` 不再形成 delegated record。Configuration 只保留一段直接說明：`loader.init` 會將 Mermaid 初始化設定交給 Mermaid；本套件只處理自己的預設與傳遞行為，完整 Mermaid options 請閱讀 Mermaid 官方 configuration 文件。

### 改寫進 Writing Diagrams

4 個 `authoring-input` records 全部改寫為一般教學內容：

| 原 record | Writing Diagrams 內容 |
| --- | --- |
| `authoring.component.code` | `<Mermaid>` component 接收 URI-encoded diagram source 的範例。 |
| `authoring.markdown.fence` | `mermaid` fenced code block 的主要寫法。 |
| `authoring.markdown.fence.title` | Fence inline `title` metadata 的範例。 |
| `authoring.markdown.fence.display-mode` | Fence inline `displayMode` metadata 的範例。 |

其餘 5 個 delegated records 不各自顯示，而是合併成一般段落：

| 原 record | 改寫方式 |
| --- | --- |
| `delegated.component-page-config` | 說明 `<Mermaid>.pageConfig` 套用到單一 component，且不能與 direct `config` 同時使用。 |
| `delegated.component-direct-config` | 說明 `<Mermaid>.config` 直接交給 Mermaid；不重印 Mermaid schema。 |
| `delegated.markdown-page-config` | 說明 Markdown page-level config 套用到該頁 diagrams。 |
| `delegated.markdown-diagram-config` | 說明 fence/frontmatter config 套用到單一 diagram。 |
| `delegated.markdown-frontmatter-other` | 說明其他 Mermaid YAML frontmatter keys 由 Mermaid 解釋，並連到 Mermaid 官方文件。 |

Writing Diagrams 只保留對使用者有用的 precedence 摘要：fence inline metadata 高於 diagram YAML frontmatter，diagram 設定高於 page/application defaults。它不顯示 transport taxonomy。

### 直接丟棄的內部資料

下列資料不改寫進公開網站：

- `kind`、`fragment` 與 record count。
- `artifactVersion` 與網站宣稱對應特定 npm artifact 的 identity。
- `evidence` source anchors、probe 結果與 parity metadata。
- 每筆 record 重複的 `ownership`、`boundary`、`scope`、`lifecycle`、`reset` 與 `errorSemantics` 結構。
- `supportedConstraint`、`recommendedRange`、`localValidation` 的機器欄位包裝；其中真正影響使用方式的一句限制可以直接寫進選項說明。
- `deprecation` object 包裝與重複的 “Not deprecated” 文案；只保留實際 deprecated 的 `theme.useColorModeTheme` 遷移提醒。
- `explicitNegatives` 清單的資料結構；只有仍與遷移相關的舊名稱才以普通文字保留在 Migration。
- strict-pure-data taxonomy、`constraint`、`unknownKeyPolicy`、`packageFields`、`allowances`、`exclusions` 與 `transportRestrictions`。
- direct Mermaid config 的 function/RegExp/Trusted Types capability path allowlist。
- 每個 surface 的 machine-readable `occurrences` 陣列；只保留一般使用者需要的優先序摘要。

Mermaid 擁有設定語意這個事實會保留為一段普通說明，但不再以每筆 record 的 ownership metadata 表達。

## 完整刪除與取代範圍

### 舊網站 runtime 與頁面

刪除：

- `assets/contract-demo/basic.mmd`
- `website/components/ContractDemo.vue`
- `website/components/PageShell.vue`
- `website/components/ReferenceAuthoringRecord.vue`
- `website/components/ReferenceConfigurationRecord.vue`
- `website/components/ReferenceDelegatedRecord.vue`
- `website/pages/index.vue`
- `website/pages/getting-started.vue`
- `website/pages/troubleshooting.vue`
- `website/pages/migration/v3.vue`
- `website/pages/reference.vue`
- `website/content/reference.md`
- `website/reference/records.v1.json`
- `website/utils/reference-format.ts`

取代或重新命名：

- `website/content/index.md` → `website/content/1.index.md`
- `website/content/getting-started.md` → `website/content/2.getting-started.md`
- 新增 `website/content/3.writing-diagrams.md`
- 新增 `website/content/4.configuration.md`
- `website/content/troubleshooting.md` → `website/content/5.troubleshooting.md`
- `website/content/migration/v3.md` → `website/content/6.migration/1.v3.md`
- 新增 `website/pages/[...slug].vue`
- 新增 `website/layouts/docs.vue`
- 簡化 `website/assets/css/main.css`、`website/content.config.ts`、`website/nuxt.config.ts` 與 `website/package.json`

### 網站 scripts

刪除整個 `scripts/website/`，包含：

- `adoption.mjs`
- `artifact.mjs`
- `reference-corpus.d.mts`
- `reference-corpus.mjs`
- `reference-parity.d.mts`
- `reference-parity.mjs`
- `reference-public.d.mts`
- `reference-public.mjs`
- `reference-verifier.d.mts`
- `reference-verifier.mjs`
- `static-site.mjs`
- `verify.mjs`

### 網站驗證測試

刪除：

- `test/ciWorkflow.test.ts`
- `test/websiteArtifact.test.ts`
- `test/websiteBoundary.test.ts`
- `test/websiteReferenceCorpus.test.ts`
- `test/websiteReferenceParity.test.ts`
- `test/websiteReferencePublic.test.ts`
- `test/websiteReferenceRender.test.ts`
- `test/websiteReferenceVerifier.test.ts`
- `test/websiteStaticSite.test.ts`
- `test/websiteVerification.test.ts`

不得新增替代性的 website boundary、navigation、content parity 或 static artifact tests。

### Root、CI、artifact 與 release

- 從 root `package.json` 移除 `test:website-static`、`verify:website`、`verify:website-artifact`、`verify:website-reference`。
- 從 `.github/workflows/ci.yml` 移除 `Verify documentation website` step。
- 在 root ESLint flat config 全域忽略 `website/**`。
- 在 root Vitest config 排除 `website/**`。
- root TypeScript config 繼續排除 `website`。
- root module build/prepack 只處理套件，不增加任何網站輸入。
- package artifact 與 release scripts 不讀取 `website/**`、網站 manifest、網站輸出或網站內容。
- 將 `test/releaseVerificationOperations.test.ts` 中僅作為 unexpected package path 範例的 website/Contract Demo 路徑改為一般非套件路徑，避免 release tests 建立網站 contract。
- `.github/workflows/publish.yml` 不新增任何網站 step。
- 更新 `pnpm-lock.yaml` 只反映網站 workspace dependency 的正常變更，不加入 artifact identity metadata。

### 已過時的設計歷史

刪除已完成且與本規格衝突的舊 spike 文件：

- `docs/superpowers/plans/2026-08-14-documentation-candidate-shell-spike.md`
- `docs/spikes/documentation-candidate-shell-result.md`

保留 `docs/research/documentation-site-architecture-comparison.md` 作為非規範性的研究背景。本檔是唯一正式網站契約。

## 品質與交付邊界

### Root 與 CI

以下 root commands 均不得讀取、解析或驗證 `website/**`：

- `pnpm lint`
- `pnpm test`
- `pnpm test:types`
- `pnpm prepack`
- `pnpm verify:source`

CI 不執行網站的 lint、test、typecheck、build、generate、browser check 或 content check。網站變更不能使 package CI job 失敗，workspace installation 本身除外。

### Artifact 與 release

Publishable package artifact 仍由套件自己的 `files: ["dist"]` 與 release verification 管理，但該流程不以網站作為輸入或對照物。它不檢查網站是否使用 registry artifact、workspace source、正確版本或最新文件。

Release checklist、release PR、publish workflow 與 post-publish recovery 不包含 Website Synchronization 或文件更新 gate。

### 本機網站操作

`website/package.json` 可以保留：

- `dev`: 本機閱讀與編輯。
- `generate`: 維護者或 AI agent 需要時的一次性輸出。

這些命令不由 root scripts、CI、artifact 或 release 呼叫。網站不保留專用 `typecheck`、verify 或 test script；AI agent 可以在個別工作中臨時執行 Nuxt 的公開命令並人工檢查結果，但不得把檢查升格成永久流程。

## 禁止重新發明 records

最終架構符合以下不可變條件：

- 只有一個 `docs` page collection，沒有 data collection。
- 只有六個手寫 Markdown 文件，沒有 JSON/YAML/TypeScript option inventory。
- frontmatter 只使用 Nuxt Content 的頁面 metadata，不承載 configuration records。
- `.navigation.yml` 若出現，只處理目錄導覽 metadata。
- Sidebar 直接來自 `queryCollectionNavigation()`，不生成或提交第二份 navigation manifest。
- TOC 直接來自 Markdown heading，不生成或提交 anchor manifest。
- Configuration 與 Writing Diagrams 是手寫 prose、tables 與 examples，不由 public types 或 source code 生成。
- 沒有 record components、public projection、virtual module、schema probe、parity、freshness、artifact identity 或 release verifier。
- AI agent 的臨時檢查結果不提交為新的網站資料模型或 release contract。

若未來內容規模變大，先增加一個 Markdown 頁面；只有在真實的重複維護問題已經出現時，才重新討論共用 content component。不得以預測性需求重建本次移除的系統。

## 驗收條件

設計實作完成時應滿足：

1. 六個 Markdown 路徑都由同一個 `pages/[...slug].vue` 查詢與渲染。
2. Sidebar 來自 `queryCollectionNavigation('docs')`，順序來自檔案名稱。
3. 中央內容使用 `ContentRenderer`。
4. 右側 TOC 來自 `page.body.toc.links`。
5. Overview 是普通 Markdown，不依賴 custom landing component。
6. `/reference`、records、Reference components、virtual module 與 `scripts/website/` 全部不存在。
7. Root lint/test/typecheck/build 與所有 CI/release/artifact 流程均不讀取或驗證網站。
8. Repo 中不存在替代 records、schema、生成、parity 或驗證系統。

## 官方依據

- [Nuxt Content：Collection Types](https://content.nuxt.com/docs/collections/types)
- [Nuxt Content：queryCollection](https://content.nuxt.com/docs/utils/query-collection)
- [Nuxt Content：queryCollectionNavigation](https://content.nuxt.com/guide/displaying/navigation)
- [Nuxt Content：ContentRenderer](https://content.nuxt.com/docs/components/content-renderer)
- [Nuxt Content：v2 → v3 Migration](https://content.nuxt.com/docs/getting-started/migration)
- [Nuxt ESLint Module documentation](https://eslint.nuxt.com/packages/module)
