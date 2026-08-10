# v3 公開文件最小化加固 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 v3.0 發佈前修正會讓公開範例直接失敗的文件落差、精確化其餘公開契約，並把 playground production build 定位成有明確觸發條件的風險導向發佈檢查。

**Architecture:** 以 runtime 原始碼與公開型別作為唯一事實來源，直接修正中英文文件，不改動 runtime 行為或擴張 package-root API。新增一個 plain-Node Vitest 檔案，只用字串切片與負向 assertion 保護三個可執行範例不變量；其餘一般文案維持人工審閱。發佈流程只更新規格與操作指南，不修改 CI、`verify:source` 或 release automation。

**Tech Stack:** Markdown、TypeScript、Vitest、Node.js `fs`/`URL` API、pnpm。

## Global Constraints

- 只採取「最小化加固」：不修改 runtime、公開型別、package exports、Nuxt module 註冊或相依套件。
- `test/documentationContract.test.ts` 只保護三個會讓使用者範例直接失敗的不變量；不得加入全文 snapshot、README generator、Markdown parser、通用文件測試 helper/framework，或一般文案 assertion。
- 文件契約測試使用簡單、可讀的負向 assertion，並為每個 assertion 提供能指出文件與修正方向的失敗訊息。
- `pnpm dev:build` 不得加入 `.github/workflows/ci.yml`、`package.json` 的 `verify:source`，也不得整合進 release automation。
- `pnpm dev:build` 僅在 major/minor 發佈前，或變更影響 Nuxt Content 整合、runtime 註冊、建置設定、相關相依套件時執行，並在 release 或 PR 的 Validation/checklist 留下結果。
- 2026-08-10 已為 v3.0 手動成功執行 `pnpm dev:build`；本計畫的純文件與文件測試修改不要求為形式一致而重跑。
- 中英文文件必須表達同一契約，但不要求逐字直譯。

---

## 一、發佈前阻斷修正

### Task 1：先建立三個失敗範例的極窄契約測試

**Files:**

- Create: `test/documentationContract.test.ts`
- Read as fixtures: `README.md`
- Read as fixtures: `README.zh-TW.md`
- Read as fixtures: `docs/en/MANUAL_THEME_CONTROL.md`
- Read as fixtures: `docs/ch/MANUAL_THEME_CONTROL.md`

- [ ] 建立 `test/documentationContract.test.ts`，完整內容如下：

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function readDocument(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

function sectionBetween(
  documentName: string,
  document: string,
  startHeading: string,
  endHeading: string,
): string {
  const start = document.indexOf(startHeading)
  if (start === -1) {
    throw new Error(`${documentName}: missing section heading ${startHeading}`)
  }

  const end = document.indexOf(endHeading, start + startHeading.length)
  if (end === -1) {
    throw new Error(`${documentName}: missing section boundary ${endHeading}`)
  }

  return document.slice(start, end)
}

function vueExamples(documentName: string, section: string): string {
  const examples = [...section.matchAll(/```vue\n([\s\S]*?)\n```/g)]
    .map(match => match.at(1) ?? '')

  if (examples.length === 0) {
    throw new Error(`${documentName}: custom renderer section must keep a Vue example`)
  }

  return examples.join('\n')
}

const readmes = {
  'README.md': readDocument('../README.md'),
  'README.zh-TW.md': readDocument('../README.zh-TW.md'),
}

const manualThemeGuides = {
  'docs/en/MANUAL_THEME_CONTROL.md': readDocument('../docs/en/MANUAL_THEME_CONTROL.md'),
  'docs/ch/MANUAL_THEME_CONTROL.md': readDocument('../docs/ch/MANUAL_THEME_CONTROL.md'),
}

describe('public documentation executable examples', () => {
  it('does not assign explicit undefined in public configuration examples', () => {
    for (const [documentName, document] of Object.entries(readmes)) {
      expect(
        document,
        `${documentName}: omit unset configuration properties instead of assigning explicit undefined`,
      ).not.toMatch(/^[ \t]*[$A-Z_a-z][$\w]*[ \t]*:[ \t]*undefined,?[ \t]*$/m)
    }
  })

  it('does not import useMermaidTheme from the package root', () => {
    const rootImport
      = /import\s*\{[^}]*\buseMermaidTheme\b[^}]*\}\s*from\s*['"]@barzhsieh\/nuxt-content-mermaid['"]/

    for (const [documentName, document] of Object.entries(manualThemeGuides)) {
      expect(
        document,
        `${documentName}: useMermaidTheme is a Nuxt auto-import and is not exported from the package root`,
      ).not.toMatch(rootImport)
    }
  })

  it('does not render Mermaid inside configured custom renderer examples', () => {
    const customRendererSections = {
      'README.md': sectionBetween(
        'README.md',
        readmes['README.md'],
        '### Custom Rendering Component',
        '### Wrapper Example',
      ),
      'README.zh-TW.md': sectionBetween(
        'README.zh-TW.md',
        readmes['README.zh-TW.md'],
        '### 自訂渲染元件 (Custom Component)',
        '### 元件使用方式',
      ),
    }

    for (const [documentName, section] of Object.entries(customRendererSections)) {
      expect(
        vueExamples(documentName, section),
        `${documentName}: a configured custom renderer must render directly instead of nesting <Mermaid>`,
      ).not.toMatch(/<Mermaid(?:\s|>)/)
    }
  })
})
```

- [ ] 執行單檔測試，確認目前正好暴露三類問題：

```bash
pnpm exec vitest run test/documentationContract.test.ts
```

預期結果：測試失敗；訊息分別指出 README 的 explicit `undefined`、Manual Theme guide 的錯誤 root import，以及中文版 Custom Renderer 的巢狀 `<Mermaid>`。英文 Custom Renderer 的 Vue 範例本身應通過。

### Task 2：移除公開設定範例中的 explicit `undefined`

**Files:**

- Modify: `README.md`（Configuration 主範例與 components 表格）
- Modify: `README.zh-TW.md`（設定主範例與 components 表格）
- Verify: `test/documentationContract.test.ts`

- [ ] 從兩份 README 的主要 `contentMermaid` 設定範例中完整移除以下未使用區塊，不改成 `null` 或空字串：

```ts
components: {
  renderer: undefined,
  spinner: undefined,
  error: undefined,
},
```

- [ ] 將英文 components 表格三個 Default 欄位由 `` `undefined` `` 改成 `omitted`，說明保留 `Optional` 語意。
- [ ] 將中文版 components 表格三個「預設值」由 `` `undefined` `` 改成「未設定」，說明保留選填語意。
- [ ] 只執行對應測試名稱，確認第一個不變量已轉綠：

```bash
pnpm exec vitest run test/documentationContract.test.ts -t "does not assign explicit undefined"
```

### Task 3：把 `useMermaidTheme` 明確記錄成 Nuxt auto-import

**Files:**

- Modify: `docs/en/MANUAL_THEME_CONTROL.md`（Basic Usage）
- Modify: `docs/ch/MANUAL_THEME_CONTROL.md`（基本用法）
- Verify: `test/documentationContract.test.ts`

- [ ] 在英文 Basic Usage 範例前加入以下契約文字：

```markdown
After this module is registered in Nuxt, `useMermaidTheme` is available as a
Nuxt auto-import. Do not import it from the package root.
```

- [ ] 在中文版基本用法範例前加入對等文字：

```markdown
在 Nuxt 註冊本模組後，`useMermaidTheme` 會由 Nuxt 自動匯入；請勿從套件
root import。
```

- [ ] 從兩個 `<script setup>` 範例刪除這一行，不新增任何替代 import：

```ts
import { useMermaidTheme } from '@barzhsieh/nuxt-content-mermaid'
```

- [ ] 執行對應測試名稱，確認第二個不變量已轉綠：

```bash
pnpm exec vitest run test/documentationContract.test.ts -t "does not import useMermaidTheme"
```

### Task 4：重寫中文版 Custom Renderer 範例，避免遞迴 ownership

**Files:**

- Modify: `README.zh-TW.md`（`### 自訂渲染元件 (Custom Component)` 到 `### 元件使用方式` 之前）
- Reference only: `README.md`（`### Custom Rendering Component`）
- Verify: `test/documentationContract.test.ts`

- [ ] 刪除目前兩個會在 `components.renderer` 內再次渲染 `<Mermaid>` 的 Vue 範例與重複 spinner 範例。
- [ ] 在中文版先補上與英文版一致的 ownership 契約：設定名稱在元件解析完成前只是候選；找不到或載入失敗才回退 Built-in Renderer；解析成功後由 Custom Renderer 完全擁有渲染，之後的 mount/render 失敗不會回退。
- [ ] 使用單一設定範例，同時示範 renderer 與選填 spinner：

```ts
contentMermaid: {
  components: {
    renderer: 'MyCustomMermaid',
    spinner: 'MySpinner', // 選填：傳入自訂渲染元件
  },
}
```

- [ ] 使用下列直接呼叫 `$mermaid()` 的 Vue 範例取代巢狀 `<Mermaid>`：

```vue
<script setup lang="ts">
import { onMounted, ref, shallowRef, useId } from 'vue'
import type { Component } from 'vue'

const props = defineProps<{
  code?: string
  spinner: Component | string
}>()

const loading = ref(true)
const error = shallowRef<unknown>()
const svg = ref('')
const renderId = `custom-mermaid-${useId().replaceAll(':', '')}`

onMounted(async () => {
  try {
    const mermaid = await useNuxtApp().$mermaid()
    svg.value = (await mermaid.render(renderId, props.code ?? '')).svg
  }
  catch (cause) {
    error.value = cause
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="custom-wrapper border rounded p-4">
    <component
      :is="props.spinner"
      v-if="loading"
    />
    <p
      v-else-if="error"
      role="alert"
    >
      圖表渲染失敗：{{ error instanceof Error ? error.message : String(error) }}
    </p>
    <div
      v-else
      v-html="svg"
    />
  </div>
</template>
```

- [ ] 在範例後明確記錄：Custom Renderer 收到既有的 `code`、default slot 與 `spinner` 輸入；Built-in 的設定、主題、toolbar、loading 與 error state 不會傳入，`components.error` 也只處理 Built-in Mermaid render failure。
- [ ] 加入明確警告：目前被設定為 `components.renderer` 的元件不得渲染 `<Mermaid>`，否則巢狀元件會再次選中同一個 renderer；應直接呼叫 `$mermaid()`、其他 library 或自己的 renderer。
- [ ] 執行完整單檔測試，確認三個不變量全部通過：

```bash
pnpm exec vitest run test/documentationContract.test.ts
```

- [ ] 完成本部分後建立單一、可審閱的 commit：

```bash
git add README.md README.zh-TW.md docs/en/MANUAL_THEME_CONTROL.md docs/ch/MANUAL_THEME_CONTROL.md test/documentationContract.test.ts
git commit -m "fix(docs): correct failing v3 public examples"
```

## 二、公開契約精確化

### Task 5：移除未實作的 loader 宣稱，校正 Nuxt Content 資料庫前提

**Files:**

- Modify: `README.md`（Features、Quick Setup 的 database note）
- Modify: `README.zh-TW.md`（功能特色、快速開始的 database note）
- Source of truth: `src/types/config.ts`
- External reference: `https://content.nuxt.com/docs/getting-started/installation`

- [ ] 將英文 Highly customizable 文字改成只列出實際 extension points：

```markdown
- **Highly customizable**: Supports custom renderers, loading spinners, error views, themes, and toolbar controls.
```

- [ ] 將中文版改成對等語意，不再宣稱 CDN 或 local import source：

```markdown
- **高度客製**：支援自訂渲染元件、Loading Spinner、錯誤畫面、主題與工具列控制。
```

- [ ] 將英文 `better-sqlite3` note 改成條件式說明：Nuxt Content 需要可用的資料庫 connector；依安裝的 Nuxt Content 版本與 Node runtime，可選 native SQLite 或 `better-sqlite3`／`sqlite3` 等 connector，實際選項以官方安裝指南為準。本模組不擁有或強制指定該 connector。
- [ ] 將中文版 note 同步成相同責任邊界。
- [ ] 只有在使用者選擇需要原生 build script 的 connector 時，才保留 pnpm v10 `approve-builds`／`onlyBuiltDependencies` 提示；不要再把 `better-sqlite3` 安裝命令呈現成無條件必要步驟。
- [ ] 確認兩份 README 都連到 Nuxt Content 官方安裝文件：

```markdown
https://content.nuxt.com/docs/getting-started/installation
```

### Task 6：以 runtime 真實值校正 loader defaults 與 theme priority

**Files:**

- Modify: `README.md`（loader/theme tables、Theme & Color Mode）
- Modify: `README.zh-TW.md`（loader/theme tables、主題與顏色模式）
- Modify: `docs/en/MANUAL_THEME_CONTROL.md`（Theme Priority）
- Modify: `docs/ch/MANUAL_THEME_CONTROL.md`（主題優先級）
- Source of truth: `src/runtime/constants.ts`
- Source of truth: `src/runtime/configuration/runtime-options.ts`
- Source of truth: `src/runtime/mermaid-config.ts`

- [ ] 將兩份 README 的 `loader.init` Default 欄位由只顯示 `{ startOnLoad: false }` 改為「package defaults／套件預設值」，並緊接著列出完整 baseline：

```ts
{
  startOnLoad: false,
  theme: 'default',
  fontFamily: 'Arial, sans-serif, 微軟正黑體',
  securityLevel: 'strict',
}
```

- [ ] 在 baseline 後記錄 debug-derived defaults：未明確提供時，`debug: false` 解析為 `logLevel: 5` 與 `suppressErrorRendering: true`；`debug: true` 解析為 `logLevel: 1` 與 `suppressErrorRendering: false`；使用者明確設定的值優先。
- [ ] 將 `theme.light` 說明改為只在 light color mode 或 `setMermaidTheme('light')` 策略使用，預設 `'default'`。
- [ ] 將 `theme.dark` 說明改為只在 dark color mode 或 `setMermaidTheme('dark')` 策略使用，預設 `'dark'`。
- [ ] 刪除 `theme.light`／`theme.dark` 在 color mode 不存在時都會作為一般 fallback 的描述。
- [ ] 將兩份 README 與兩份 Manual Theme guide 的 priority 統一為：

```text
1. Page/frontmatter config.theme
2. useMermaidTheme() manual mode
3. @nuxtjs/color-mode selection
4. resolved loader.init.theme (package default: 'default')
```

- [ ] 刪除獨立的第五層「fallback to `theme.light`」說法；實作中的 `baseTheme ?? lightTheme ?? 'default'` 是內部防禦性 fallback，而公開 runtime snapshot 已提供 `loader.init.theme: 'default'`，不應暗示 `theme.dark` 或 `theme.light` 是沒有 color-mode selection 時的共同 base。
- [ ] 保留 Manual Theme guide 對 reserved `'light'`／`'dark'` strategy 的說明：手動或 color-mode 選擇發生時分別解析為 `lightTheme ?? 'default'` 與 `darkTheme ?? 'dark'`。

### Task 7：收斂中文版 debug 契約與重複 API 文案

**Files:**

- Modify: `README.zh-TW.md`（Debug 模式）
- Modify: `docs/ch/MANUAL_THEME_CONTROL.md`（API 細節）
- Reference only: `README.md`（Debug mode）
- Reference only: `docs/en/MANUAL_THEME_CONTROL.md`（API Details）

- [ ] 將中文版 Debug 的自動配置說明補齊「只有未明確設定時才套用；明確設定值優先」，並同時說清楚 debug 開啟與關閉的 resolved defaults。
- [ ] 將「模組會額外輸出渲染佇列診斷與執行時間統計」替換成以下公開契約：

```markdown
- **主控台輸出**：Debug log 的文字與內部渲染排程不是公開 API。設定失敗時，應辨識文件記載的公開錯誤 fingerprint，不要解析內部訊息細節。
```

- [ ] 在中文版 Manual Theme guide 刪除第二份重複的 `##### setMermaidTheme(mode)` 區塊，保留資訊較完整、含「區別說明」與四個例子的單一版本。
- [ ] 不為這些一般文案新增 assertion；以中英文並排 diff 人工確認語意一致。
- [ ] 完成本部分後建立單一 commit：

```bash
git add README.md README.zh-TW.md docs/en/MANUAL_THEME_CONTROL.md docs/ch/MANUAL_THEME_CONTROL.md
git commit -m "docs: align public contract with v3 runtime"
```

## 三、發佈流程調整

### Task 8：把 playground build 從完成條件改成風險導向檢查

**Files:**

- Modify: `docs/specs/v3-configuration-architecture.md`（Verification Boundary）
- Do not modify: `.github/workflows/ci.yml`
- Do not modify: `package.json`

- [ ] 從 Verification Boundary 最後一個「tests cover」項目移除 `playground production build`，保留 lint、unit tests、type tests、package build 與 relevant Nuxt browser fixtures。
- [ ] 在測試清單後加入獨立段落，使用以下規格文字：

```markdown
Playground production build is a risk-based release-readiness check rather than
a mandatory CI or `verify:source` gate. Run `pnpm dev:build` before major or
minor releases, and when changes affect Nuxt Content integration, runtime
registration, build configuration, or relevant dependencies. Record the command
and result in the release or PR checklist.
```

- [ ] 確認規格不再把 production build 描述為每次 PR 或每次 `verify:source` 的必要 gate。

### Task 9：在 release guide 落實觸發條件與證據邊界

**Files:**

- Modify: `docs/en/RELEASING.md`（Before starting）
- Reference only: `.github/PULL_REQUEST_TEMPLATE.md`（既有 Validation 區段）
- Do not modify: `.github/PULL_REQUEST_TEMPLATE.md`
- Do not modify: `scripts/release-verification/**`

- [ ] 在 `Before starting` 加入以下條件式步驟：

```markdown
- Determine whether the playground production build is required. Run
  `pnpm dev:build` before every major or minor release, and for any release whose
  changes affect Nuxt Content integration, runtime registration, build
  configuration, or relevant dependencies. Record the command and result in the
  release checklist or the PR's Validation section. This is a risk-based
  release-readiness check, not part of CI or `verify:source`.
```

- [ ] 不把一次性的 v3.0 成功紀錄硬編碼進長期 release guide；在執行本計畫的 PR/release Validation 中記錄「2026-08-10 已手動執行 `pnpm dev:build` 並成功」。
- [ ] 不修改 PR template，因為既有 `## Validation` 已足以承接條件式結果；不新增永久 checkbox，避免讓所有低風險 PR 誤以為必跑。
- [ ] 不修改 release evidence schema 或 automation；這個檢查由 maintainer 依風險判斷並留下人類可讀證據。
- [ ] 完成本部分後建立單一 commit：

```bash
git add docs/specs/v3-configuration-architecture.md docs/en/RELEASING.md
git commit -m "docs: make playground build a risk-based release check"
```

## 四、驗證方式

### Task 10：執行由窄到廣的驗證，確認沒有擴張 gate

**Files:**

- Verify: `test/documentationContract.test.ts`
- Verify: `README.md`
- Verify: `README.zh-TW.md`
- Verify: `docs/en/MANUAL_THEME_CONTROL.md`
- Verify: `docs/ch/MANUAL_THEME_CONTROL.md`
- Verify: `docs/specs/v3-configuration-architecture.md`
- Verify: `docs/en/RELEASING.md`
- Confirm unchanged: `.github/workflows/ci.yml`
- Confirm unchanged: `package.json`

- [ ] 執行極窄文件契約測試：

```bash
pnpm exec vitest run test/documentationContract.test.ts
```

預期：三個 `it` 全部通過；測試沒有 snapshot、Markdown parser、generator 或一般文案 assertion。

- [ ] 只 lint 新測試，先取得快速回饋：

```bash
pnpm exec eslint test/documentationContract.test.ts
```

- [ ] 執行完整 source gate：

```bash
pnpm verify:source
```

預期：lint、全部 Vitest tests、root 與 playground type tests 全部通過。

- [ ] 執行文字層級的人工邊界檢查；這些是執行者核對命令，不新增為測試：

```bash
rg -n "renderer: undefined|spinner: undefined|error: undefined" README.md README.zh-TW.md
rg -n "import \{ useMermaidTheme \} from '@barzhsieh/nuxt-content-mermaid'" docs/en/MANUAL_THEME_CONTROL.md docs/ch/MANUAL_THEME_CONTROL.md
rg -n "CDN|local import|better-sqlite3.*requires|需要.*better-sqlite3" README.md README.zh-TW.md
rg -n "pnpm dev:build|major or minor|Nuxt Content integration|runtime registration" docs/specs/v3-configuration-architecture.md docs/en/RELEASING.md
```

預期：前三個命令沒有命中已移除的錯誤契約；最後一個命令只在規格與 release guide 命中風險導向文字。

- [ ] 確認 CI、source gate 與 release automation 未被擴張：

```bash
git diff --exit-code -- .github/workflows/ci.yml package.json scripts/release-verification
```

預期：無 diff。

- [ ] 檢查 whitespace 與最終修改範圍：

```bash
git diff --check
git status --short
git diff --stat
```

- [ ] 本次不要重跑 `pnpm dev:build`。在 PR/release Validation 記錄既有證據：v3.0 已於 2026-08-10 手動成功完成 playground production build；本計畫修改未觸及任何會重新觸發該檢查的整合、註冊、建置或相依套件範圍。

- [ ] 最終人工審閱只回答四個問題：
  1. 三個公開範例是否都能依文件直接使用而不失敗？
  2. 中英文 loader/theme/debug 契約是否與 runtime source 一致？
  3. 文件是否不再宣稱不存在的 loader source 或強制 database connector？
  4. `pnpm dev:build` 是否只存在於風險導向 release-readiness 說明，而未進入自動 gate？
