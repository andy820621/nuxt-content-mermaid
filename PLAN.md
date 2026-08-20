# Nuxt SEO 第一階段：系統化 SEO 與靜態 GEO 實作計畫

> **For agentic workers:** 依 `$implement`、`$tdd` 與 `$code-review` 執行。每個行為以 generated-site E2E 公開 seam 完成 RED → GREEN，並在每個 Task 後驗證、checkpoint、commit。

**Goal:** 讓文件網站只維護內容事實，由 Nuxt SEO 系統化衍生 canonical、social metadata、Schema、crawler artifacts 與靜態 AI-readable 文件，避免未來在 page、app 與 build scripts 間手動同步。

**Architecture:** `內容事實（標題、描述、語系、路由） → Nuxt SEO 統一衍生 → generated-site E2E 驗證公開產物`。不複製 Portfolio 的部落格級 identity、Article schema、動態 OG 或自訂 audit scripts。

**Tech Stack:** Nuxt 4.5.2、Nuxt Content 3.15.2、Nuxt I18n 10.6.0、`@nuxtjs/seo` 5.x、`nuxt-ai-ready` 2.0.1、Vitest 4.1.11、Playwright 1.62.1。

**Spec:** `docs/specs/documentation-website.md`

## 全域限制與決策

- Production authority 固定為 `https://nuxt-content-mermaid.barz.app`。
- `SITE_ORIGIN`、`SITE_NAME`、`SITE_DESCRIPTION` 與 `PUBLIC_ROUTES` 是網站公開身分的來源。
- `PUBLIC_ROUTES` 只列正式 HTML 文件頁；`.md`、`llms.txt`、`llms-full.txt` 是衍生產物，不加入 sitemap。
- 使用 `@nuxtjs/seo@^5.3.14` 取代 direct `nuxt-site-config`、`@nuxtjs/robots`、`@nuxtjs/sitemap` registrations。
- 精確鎖定 `nuxt-ai-ready@2.0.1`；只啟用 build-time static artifacts。
- internal broken links/fragments 阻擋 generate；不抓取 external URLs。
- Open Graph 使用既有 static image；dynamic OG image 明確停用。
- 不建立 Person、Organization、Article、BlogPosting、SoftwareApplication identity。
- 不啟用 runtime database、runtime sync、content negotiation、MCP、WebMCP、cron、Agent Skills、API Catalog、Content Signal 或 IndexNow。
- 不變更 npm package API、runtime types、Mermaid module 行為或 release contract。
- 保留所有使用者變更；不 rebase、不 squash、不 amend 既有 commits。
- 不 push、不建立 PR、不合併。

## 公開 ownership

| 資料或產物 | 唯一 owner |
|---|---|
| origin、站名、預設描述、HTML route inventory | `website/utils/site.ts` |
| 每頁標題與描述 | Nuxt Content page + `useSeoMeta` |
| canonical、HTML lang、title template、OG、Twitter | Nuxt SEO Utils |
| reciprocal hreflang、`og:locale:alternate` | Nuxt I18n |
| WebSite、WebPage JSON-LD | Nuxt Schema.org defaults |
| sitemap、robots | `@nuxtjs/seo` 內含模組 |
| `.md`、`llms.txt`、`llms-full.txt` | `nuxt-ai-ready` |
| internal link build gate | Nuxt Link Checker |

## Task 0：鎖定工作狀態與追蹤契約

**Files:**

- Create: `PLAN.md`
- Read: `CONTEXT.md`
- Read: `docs/agents/issue-tracker.md`
- Update: GitHub Issue #129

- [x] 確認目前為 `codex/seo-foundations`，不是 `main`/`master`。
- [x] 確認 worktree 無待保留的 dirty changes；執行時原先的 `PLAN.md` 已不存在。
- [x] 確認既有 commits 保留在 branch，不改寫歷史。
- [x] 執行 generated-site baseline：8 files、47 tests 通過。
- [x] 執行 website typecheck：通過。
- [x] 以本計畫更新既有 Issue #129，不建立重複 Issue、不關閉 Issue。
- [x] 執行 `git diff --check`、status、diff stat。
- [ ] Commit：`docs(website): revise Nuxt SEO implementation plan`

## Task 1：以 `@nuxtjs/seo` 統一 SEO ownership

### RED

擴充 `website/test/generatedSite.e2e.test.ts`，透過生成後 HTML 驗證：

- 所有 `PUBLIC_ROUTES` 只有一個 production canonical。
- primary title/description 與 OG、Twitter title/description 語意一致。
- 所有頁面都有 static social image、image alt 與 `summary_large_image`。
- `en-US`、`zh-TW` reciprocal alternates 不重複。
- 解析所有 JSON-LD scripts 與 `@graph`；每頁有對應 canonical、description、language 的 WebPage，且 `isPartOf` 指向同語系 WebSite。
- 移除「只有英文首頁有完全相等 raw WebSite JSON」的 implementation-coupled assertion。

先執行單一測試檔，確認因缺少全站 Schema/Twitter 推導而 RED。若失敗不是新契約缺口，先診斷既有回歸。

### GREEN

1. `website/package.json`：
   - 新增 `@nuxtjs/seo: ^5.3.14`。
   - 移除 direct `@nuxtjs/robots`、`@nuxtjs/sitemap`、`nuxt-site-config`。
   - 更新 `pnpm-lock.yaml`，不手動指定 umbrella transitive versions。
2. `website/nuxt.config.ts`：
   - 以 `@nuxtjs/seo` 取代三個 direct registrations。
   - 保留既有 `sitemap`、`robots` 與 prerender 契約。
   - 設定 site identity、static social defaults、link checker 與停用 dynamic OG：

```ts
site: {
  name: SITE_NAME,
  url: SITE_ORIGIN,
  description: SITE_DESCRIPTION,
  trailingSlash: false,
  titleSeparator: '·',
},
seo: {
  // Avoid mutating Content/Shiki inline styles between SSR and hydration.
  minify: false,
  meta: {
    ogImage: toSiteURL('/assets/nuxt-content-mermaid.png'),
    ogImageAlt: SITE_NAME,
    twitterCard: 'summary_large_image',
    twitterImage: toSiteURL('/assets/nuxt-content-mermaid.png'),
    twitterImageAlt: SITE_NAME,
  },
},
linkChecker: {
  runOnBuild: true,
  failOnError: true,
  fetchRemoteUrls: false,
},
ogImage: {
  enabled: false,
},
```

3. `website/utils/site.ts` 新增英文預設 `SITE_DESCRIPTION`；`PUBLIC_ROUTES` 語意不變。
4. 英文與繁中 locale messages 新增 `nuxtSiteConfig.name`、`nuxtSiteConfig.description`。
5. `website/app.vue`：
   - 刪除手寫 title template、canonical、global OG/Twitter 與 raw WebSite JSON-LD。
   - `useLocaleHead` 只輸出 `rel="alternate"` 與 `og:locale:alternate`。
   - 保留 favicon、body attributes 與 root alternate URL 正規化。
6. 新增窄介面 `useDocumentationSeo(page)`：頁面只傳一次 reactive `title`、`description`；Nuxt SEO 自動衍生 OG，adapter 補足 module 不會自動產生的 `twitter:title`、`twitter:description`，並把 page facts 與目前語系合併進預設 WebPage node。
7. `website/pages/index.vue` 與 `website/pages/[...slug].vue` 改用此介面，移除重複 `ogTitle`、`ogDescription`。
8. 不複製 Portfolio 的 Article、publisher identity 或 Content schema；WebSite identity 與 WebPage linkage 仍由 Nuxt SEO defaults 衍生。
9. 執行 `nuxt prepare` 重新產生官方型別。

### Checkpoint

```bash
pnpm --dir website exec vitest run test/generatedSite.e2e.test.ts
pnpm exec vue-tsc -p website/tsconfig.json --noEmit
pnpm exec eslint --no-ignore website/nuxt.config.ts website/app.vue website/pages/index.vue 'website/pages/[...slug].vue' website/utils/site.ts website/test/generatedSite.e2e.test.ts
git diff --check
git status --short
git diff --stat
```

Commit：`feat(website): centralize Nuxt SEO orchestration`

**Checkpoint result:** RED 精確捕捉缺少 `twitter:title`；GREEN 後 focused generated-site E2E 6/6、website typecheck、targeted ESLint 與 `git diff --check` 通過。實作期間確認 SEO Utils build minifier 會改寫 Content/Shiki inline style 並造成 hydration mismatch，因此以 `seo.minify: false` 保留 SSR/client 一致性，既有 hydration E2E 已鎖定此回歸。

## Task 2：加入靜態 AI-ready / GEO 產物

### RED

在相同 generated-site seam 驗證：

- `/` 對應 `/index.md`；其餘 `PUBLIC_ROUTES` 對應 `${normalizedRoute}.md`。
- Markdown 非空、包含對應頁面的主要標題或內容，不含 HTML shell、`__NUXT__` 或 scripts。
- 每個 HTML page 有且只有一個對應 `rel="alternate" type="text/markdown"`。
- `/llms.txt` 有站名、描述、`/llms-full.txt`、英文文件 inventory 與繁中語系入口。
- `/llms-full.txt` 不是 prerender placeholder，並包含代表性的英文與繁中文件內容。
- sitemap 仍完全等於 HTML `PUBLIC_ROUTES`，排除 `.md` 與 llms files。
- robots policy 不被 AI module 改寫。

先執行單一測試檔，確認缺少 AI artifacts 的預期 RED。

### GREEN

1. 精確加入 `nuxt-ai-ready: 2.0.1`。
2. 在 `@nuxt/content`、`@nuxtjs/i18n` 已註冊且 umbrella sitemap 已存在後註冊 module。
3. 使用純靜態設定：

```ts
aiReady: {
  contentNegotiation: false,
  contentSource: true,
  database: false,
  runtimeSync: false,
  cron: false,
  apiCatalog: false,
  contentSignal: false,
  webmcp: false,
  agentSkills: false,
  mcpServerCard: false,
  mcp: {
    tools: false,
    resources: false,
  },
  autoI18n: true,
  llmsTxt: {
    markdownLinks: true,
    notes: 'Official English and Traditional Chinese documentation for Nuxt Content Mermaid.',
  },
},
```

4. 從 Content source 與 sitemap 自動衍生；不建立第二份 route inventory、生成 script 或手寫 llms manifest。
5. 若 `2.0.1` 無法在關閉 runtime features 時提供上述 artifacts，停止並詢問，不自行更換套件或打開 runtime API。

### Checkpoint

```bash
pnpm --dir website exec vitest run test/generatedSite.e2e.test.ts
pnpm exec vue-tsc -p website/tsconfig.json --noEmit
pnpm exec eslint --no-ignore website/nuxt.config.ts website/test/generatedSite.e2e.test.ts
git diff --check
git status --short
git diff --stat
```

Commit：`feat(website): publish static AI-readable docs`

**Checkpoint result:** RED 精確捕捉缺少 `text/markdown` alternate；GREEN 後 focused generated-site E2E 7/7、website typecheck、targeted ESLint 與 `git diff --check` 通過。生成產物包含 18 個 Markdown variants、`/llms.txt`、`/llms-full.txt`，且 sitemap 仍只包含 HTML routes。

## Task 3：更新 durable contract、完整驗證與 code review

1. 更新 `docs/specs/documentation-website.md`：
   - 記錄 ownership table。
   - 記錄 HTML routes 與衍生 AI artifacts 的界線。
   - 記錄全站 Schema、link checker、static OG 與 static-only GEO 契約。
   - 刪除「只有英文首頁有 raw WebSite JSON-LD」的舊契約。
   - 保留 dynamic OG、publisher identity、Article schema 與 runtime AI services 為 non-goals。
2. 在本計畫記錄 RED/GREEN 與 checkpoint 結果。
3. 完整驗證：

```bash
pnpm lint
pnpm test
pnpm test:types
pnpm --dir website test
pnpm --dir website generate
pnpm exec vue-tsc -p website/tsconfig.json --noEmit
git diff --check
```

4. 以 `d108e20` 為 fixed point 執行 `$code-review`：
   - Standards：AGENTS、repo conventions、TDD、ownership 與 Fowler smell baseline。
   - Spec：本計畫、Issue #129、durable contract。
5. 所有有效 findings 都必須修正；行為修正先補 RED regression test，再用獨立 Conventional Commit，最後重跑完整驗證與 review。
6. Commit：`docs(website): record SEO and GEO contract`；review fixes 視內容另建 `fix(website): ...` 或 `test(website): ...` commits。

## 完成條件

- HTML pages 的 canonical、hreflang、OG、Twitter、Schema 與語系有明確單一 owner，沒有重複 tags。
- sitemap 與 robots 原契約零回歸。
- 每個正式頁面都有 Markdown variant，且 `/llms.txt`、`/llms-full.txt` 可由靜態站提供。
- internal broken links/fragments 能阻擋 generate；external URLs 不影響 build。
- focused tests、typecheck、完整驗證及 `$code-review` 通過。
- npm package runtime/API 完全不變。

## 人工平台待辦（本階段不執行）

- Cloudflare：確認 managed robots/content signals 不覆寫 repository policy，驗證 production MIME 與 headers。
- Google Search Console：驗證 property、提交 sitemap、檢查 canonical/indexing。
- Bing Webmaster Tools：驗證網站、提交 sitemap。
- 上線後觀察搜尋收錄與 AI-readable routes；本階段不部署、不 push、不開 PR、不合併。
