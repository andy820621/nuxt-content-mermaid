[中文](./README.zh-TW.md) | [English](./README.md) 

[![nuxt-content-social-card](https://raw.githubusercontent.com/andy820621/nuxt-content-mermaid/main/src/assets/nuxt-content-mermaid.webp)](https://www.npmjs.com/package/@barzhsieh/nuxt-content-mermaid)

# nuxt-content-mermaid

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]
[![Mermaid](https://img.shields.io/badge/mermaid-11.x-0f5b9d?logo=mermaid)](https://mermaid.js.org/)
[![Nuxt Content](https://img.shields.io/badge/Nuxt%20Content-3.x-00DC82?logo=nuxt.js)](https://content.nuxt.com/)

專為 [**Nuxt Content v3**](https://content.nuxt.com/docs/getting-started) 整合 [**Mermaid**](https://mermaid.js.org/) 的模組。
能自動將 Markdown 中的 \`\`\`mermaid 區塊轉換為響應式的圖表元件，並支援 Lazy Loading 與深色模式切換。

<details>
<summary>目錄</summary>

- [功能特色](#功能特色)
- [使用前提](#使用前提)
- [相依與遷移契約](./docs/ch/DEPENDENCY_AND_MIGRATION_CONTRACT.md)
- [快速開始](#快速開始)
- [設定](#設定)
- [遷移至 v3](#遷移至-v3)
- [樣式自訂（CSS 變數）](#樣式自訂css-變數)
- [進階用法](#進階用法)
  - [Debug 模式](#debug-模式)
  - [主題與顏色模式](#主題與顏色模式-theme--color-mode)
  - [以 frontmatter 覆寫單頁設定](#以-frontmatter-覆寫單頁設定)
  - [Mermaid Inline attrs 與 YAML Frontmatter](#mermaid-inline-attrs-與-yaml-frontmatter)
  - [自訂渲染元件](#自訂渲染元件-custom-component)
  - [元件使用方式](#元件使用方式)
  - [錯誤處理](#錯誤處理)
- [支持專案](#支持專案)
- [貢獻](#貢獻)
- [授權](#授權)

</details>

## 功能特色

- **自動轉換**：解析 Markdown 代碼區塊並替換為 `<Mermaid>` 渲染元件。
- **效能優化**：支援 Lazy Loading，僅在元件掛載時載入 Mermaid 核心與資源。
- **主題整合**：無縫整合 `@nuxtjs/color-mode`，自動切換 Light/Dark 對應主題。
- **高度客製**：支援自訂渲染元件、Loading Spinner、錯誤畫面、主題與工具列控制。
- **部署期設定**：可透過 public runtime config 傳遞純資料設定，並在每個 Nuxt 應用程式初始化時解析一次。

## 使用前提

- Node.js `>=22.19.0`
- `nuxt@^4.1.0`
- `@nuxt/content@>=3.5.0 <4.0.0`

相依擁有權、2.x 遷移方式、渲染保證與視覺快照限制，請參閱[相依與遷移契約](./docs/ch/DEPENDENCY_AND_MIGRATION_CONTRACT.md)。

## 快速開始

### 1. 安裝套件

套件管理器安裝與 Nuxt 模組初始化是兩個不同步驟。您的應用程式擁有 Nuxt 與 Nuxt Content 這兩個 peer dependencies，因此必須自行安裝、鎖定與更新它們。請一併安裝本模組與支援範圍內的 Nuxt Content peer：

```bash
# pnpm
pnpm add @barzhsieh/nuxt-content-mermaid @nuxt/content

# npm
npm install @barzhsieh/nuxt-content-mermaid @nuxt/content

# yarn
yarn add @barzhsieh/nuxt-content-mermaid @nuxt/content
```

Mermaid 是本模組綁定的 Module-Owned Dependency，因此不必為了本模組另行安裝。

> [!NOTE]
> **Nuxt Content 資料庫 connector** — 在 Node.js 環境中，Nuxt Content 會由
> 應用程式選擇資料庫 connector；可用選項包含 `better-sqlite3`、`sqlite3`，
> 以及受支援 Node.js 版本提供的 native SQLite。本模組不要求或擁有特定
> connector；請依已安裝版本參閱
> [Nuxt Content 安裝指南](https://content.nuxt.com/docs/getting-started/installation)。
>
> **pnpm v10+** — 若選擇 `better-sqlite3` 或 `sqlite3`，pnpm v10 預設會
> 封鎖其原生 build script。請執行 `pnpm approve-builds`，或只在
> `package.json` 允許你選用的 connector：
>
> ```jsonc
> // package.json
> {
>   "pnpm": {
>     "onlyBuiltDependencies": ["better-sqlite3"] // 若選用 sqlite3，請替換成 "sqlite3"
>   }
> }
> ```

### 2. 初始化 Nuxt 模組

標準 `modules` 設定只需列出本模組：

```ts
export default defineNuxtConfig({
  modules: ["@barzhsieh/nuxt-content-mermaid"],
});
```

本模組透過 `moduleDependencies` 宣告必要的 Nuxt Content 關係與相容版本，因此 Nuxt 會依必要順序初始化已安裝的 `@nuxt/content` 模組。這項宣告不會安裝、鎖定或更新 Nuxt Content；這些套件管理器責任仍由您的應用程式承擔。

若您的應用程式已在 `modules` 中手動列出 `@nuxt/content`，可以保留該項設定。手動列出仍受支援，但不再是標準設定。

### 3. 在 Markdown 中使用

在 `content/` 目錄下的 `.md` 檔案中直接撰寫 Mermaid 語法：

````markdown
# 流程圖範例

```mermaid
graph LR
  A[Start] --> B{Is it working?}
  B -- Yes --> C[Great!]
  B -- No --> D[Debug]
```
````

模組會自動將其轉換為 SVG 圖表。

## 設定

請透過正式的 `contentMermaid` 選項進行全域設定。舊的 `mermaidContent` alias 已在 v3 移除，使用時會得到遷移錯誤。

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  contentMermaid: {
    enabled: true,
    loader: {
      init: {
        securityLevel: "strict",
        // 其他傳遞給 mermaid.initialize() 的參數
      },
      lazy: true,
    },
    theme: {
      light: "default",
      dark: "dark",
    },
    toolbar: {
      title: "mermaid",
      fontSize: "14px",
      fullscreenToolbarScale: 1.25,
      buttons: {
        copy: true,
        fullscreen: true,
        expand: true,
      },
    },
    expand: {
      enabled: true,
      margin: 0,
      invokeOpenOn: {
        diagramClick: true,
      },
      invokeCloseOn: {
        esc: true,
        wheel: true,
        swipe: true,
        overlayClick: true,
        closeButtonClick: true,
      },
    },
  },
});
```

### 參數說明

**Top-level**

| 參數      | 類型      | 預設值 | 說明                           |
| :-------- | :-------- | :----- | :----------------------------- |
| `enabled` | `boolean` | `true` | 是否啟用模組與轉換邏輯。       |
| `debug`   | `boolean` | `false` | 啟用除錯模式；見下方 Debug 說明。 |

**loader**

| 參數             | 類型                                   | 預設值     | 說明                                                                  |
| :--------------- | :------------------------------------- | :--------- | :---------------------------------------------------------------------- |
| `loader.init`    | `RuntimeMermaidConfig`（嚴格純資料）   | 套件預設值 | 傳遞至 `mermaid.initialize` 的純資料 Mermaid 設定。                     |
| `loader.lazy`    | `boolean \| { threshold?: number }` | `true`     | 元件進入 viewport 時才載入 Mermaid；設為 `false` 會在前一刻就載入。 |

`loader.init` 的 baseline 為：

```ts
{
  startOnLoad: false,
  theme: 'default',
  fontFamily: 'Arial, sans-serif, 微軟正黑體',
  securityLevel: 'strict',
}
```

未明確設定時，`debug: false` 會解析成 `logLevel: 5` 與
`suppressErrorRendering: true`；`debug: true` 則解析成 `logLevel: 1` 與
`suppressErrorRendering: false`。使用者明確提供的值一律優先。

**theme**

若專案安裝了 `@nuxtjs/color-mode` 會自動偵測並跟隨；透過 `useMermaidTheme()` 設定的手動主題會優先。

| 參數          | 類型   | 預設值      | 說明                                                          |
| :------------ | :----- | :---------- | :------------------------------------------------------------ |
| `theme.light` | string | `'default'` | 用於 light color mode 與手動 `setMermaidTheme('light')` 策略。 |
| `theme.dark`  | string | `'dark'`    | 用於 dark color mode 與手動 `setMermaidTheme('dark')` 策略。   |

**components**

| 參數                     | 類型     | 預設值 | 說明                                                   |
| :----------------------- | :------- | :----- | :----------------------------------------------------- |
| `components.renderer`    | `string` | 未設定 | 選填：指定自訂的 Mermaid 實作元件名稱（見進階用法）。  |
| `components.spinner`     | `string` | 未設定 | 選填：指定全域的 Loading 元件名稱。                    |
| `components.error`       | `string` | 未設定 | 選填：指定全域的錯誤顯示元件名稱，渲染失敗時會使用。   |

**toolbar**

| 參數                    | 類型               | 預設值 | 說明                                   |
| :---------------------- | :----------------- | :----- | :------------------------------------- |
| `toolbar.title`         | `string`           | `'mermaid'` | Mermaid 工具列預設標題。               |
| `toolbar.fontSize`      | `string \| number` | `'14px'`    | Mermaid 工具列預設字體大小。           |
| `toolbar.fullscreenToolbarScale` | `number`    | `1.25`      | fullscreen 時工具列字體/圖示的放大倍率。 |
| `toolbar.buttons.copy`  | `boolean`          | `true`  | 顯示工具列複製原始 Mermaid 的按鈕。    |
| `toolbar.buttons.fullscreen` | `boolean`     | `true`  | 顯示工具列全螢幕按鈕。                 |
| `toolbar.buttons.expand`  | `boolean`          | `true`  | 顯示工具列放大按鈕。                   |

**expand**

控制 SVG 放大互動行為，也可直接設為 `expand: false` 來停用，或 `expand: true` 使用預設值。

| 參數                      | 類型      | 預設值 | 說明                                                     |
| :------------------------ | :-------- | :----- | :------------------------------------------------------- |
| `expand.enabled`                      | `boolean` | `true` | 是否啟用放大功能。                                        |
| `expand.margin`                       | `number`  | `0`    | 放大後 SVG 在視窗內保留的邊距（px）。                          |
| `expand.invokeOpenOn.diagramClick`    | `boolean` | `true` | 允許直接點擊 SVG 開啟放大。                                   |
| `expand.invokeCloseOn.esc`            | `boolean` | `true` | 允許按 ESC 關閉。                                         |
| `expand.invokeCloseOn.wheel`          | `boolean` | `true` | 允許滑鼠滾輪關閉。                                        |
| `expand.invokeCloseOn.swipe`          | `boolean` | `true` | 允許滑動手勢關閉。                                        |
| `expand.invokeCloseOn.overlayClick`   | `boolean` | `true` | 允許點擊 overlay 背景關閉。                              |
| `expand.invokeCloseOn.closeButtonClick`| `boolean` | `true` | 顯示 overlay 關閉按鈕。                                   |

**平移與縮放 (Expand Overlay / Fullscreen)**

當放大 Fullscreen 或是 Expand 模式時，使用者可平移與縮放圖表：

| 操作 | 桌機 | 行動裝置 |
|:---|:---|:---|
| **平移 (Pan)** | `Space` + 拖曳 | 單指拖曳 |
| **縮放 (Zoom)** | `Ctrl/⌘` + 滾輪 | 雙指捏合 |
| **鍵盤** | `+`/`-` 縮放、方向鍵平移、`0` 重置 | — |

放大介面會顯示縮放工具列，包含 +/−/Reset 按鈕與百分比顯示。

可透過 `toolbar.fullscreenToolbarScale` 調整 Fullscreen 工具列與縮放控制的尺寸。


> **注意**：`contentMermaid.enabled` 在 Nuxt setup 時決定模組啟用狀態。設為 `false` 只會停用 Mermaid 的 Content／runtime integration，不會停用 Nuxt Content。它絕不是 public runtime 設定。`runtimeConfig.public.contentMermaid` 只能傳遞嚴格純資料，並在每個 Nuxt 應用程式初始化時解析一次；之後變更它不會更新既有的 Runtime Mermaid Snapshot。

## 遷移至 v3

[v3 遷移指南](./docs/ch/MIGRATION_V3.md)說明移除的設定 alias、建置期 activation、純資料 runtime transport、Page 與 Direct Mermaid Config、Property-Presence Merge、expand 重設語意，以及公開的診斷與渲染保證。Playground 的 `/migration` 路徑提供可操作的對照範例。

## 樣式自訂（CSS 變數）

模組會提供全域 CSS 變數（來源為 `runtime/styles.css`），讓 Mermaid 區塊與放大 overlay 使用同一套配色。你可以在專案中覆寫：

```css
:root {
  --ncm-code-bg: #f3f4f6;
  --ncm-code-bg-hover: #e5e7eb;
  --ncm-border: #e5e7eb;
  --ncm-text: #111827;
  --ncm-text-muted: #4b5563;
  --ncm-text-xmuted: #6b7280;
  --ncm-overlay-bg: rgba(255, 255, 255, 0.98);
}

html[data-theme="dark"],
.dark {
  --ncm-code-bg: #111827;
  --ncm-code-bg-hover: #1f2937;
  --ncm-border: #1f2937;
  --ncm-text: #f9fafb;
  --ncm-text-muted: #9ca3af;
  --ncm-text-xmuted: #6b7280;
  --ncm-overlay-bg: rgba(17, 24, 39, 0.98);
}
```

可覆寫的變數：
- `--ncm-code-bg`：Mermaid 區塊背景色
- `--ncm-code-bg-hover`：工具列按鈕 hover 背景
- `--ncm-border-color`：區塊與工具列的邊框顏色
- `--ncm-border-width`：邊框厚度
- `--ncm-border-style`：邊框樣式
- `--ncm-border`：邊框 shorthand（寬度、樣式、顏色）
- `--ncm-border-bottom`：工具列底部的邊框
- `--ncm-text`：主要文字顏色
- `--ncm-text-muted`：標題與次要文字
- `--ncm-text-xmuted`：工具列 icon 與更淡的文字
- `--ncm-overlay-bg`：放大 overlay 背景（預設跟 `--ncm-code-bg` 一致）
- `--ncm-expand-target-bg`：當 `expand.margin > 0` 時，放大後留白的 SVG 外框背景，可以與 overlay 做出區隔
- `--ncm-overlay-opacity`：overlay 的透明度（搭配 margin 留白時可微調濃淡）
- `--ncm-overlay-backdrop`：顯示 overlay 時加上的 `backdrop-filter`，可自訂 blur/效果
- `--ncm-hint-bg`：縮放提示訊息背景色（預設 `rgba(0,0,0,0.75)`）
- `--ncm-hint-text`：縮放提示訊息文字顏色（預設 `#fff`）
- `--ncm-hint-radius`：縮放提示訊息圓角（預設 `8px`）

## 進階用法

### Debug 模式

**`contentMermaid.debug`**（預設 `false`）：
  - **自動配置**：若未明確設定 `loader.init.logLevel` 或 `suppressErrorRendering`，`debug: false` 會解析為 `logLevel: 5` 與 `suppressErrorRendering: true`；`debug: true` 會解析為 `logLevel: 1` 與 `suppressErrorRendering: false`（允許 Mermaid 在 DOM 中顯示錯誤訊息）。明確設定的值一律優先。
  - **執行行為**：
    - **Debug 開啟**：`mermaid.run` 使用 `suppressErrors: false`，發生錯誤時會拋出完整堆疊以便除錯。
    - **Debug 關閉**：`mermaid.run` 使用 `suppressErrors: true`，避免單一圖表錯誤中斷其他圖表的渲染。
  - **主控台輸出**：Debug log 的文字與內部渲染排程不是公開 API。設定失敗時，應辨識文件記載的公開錯誤 fingerprint，不要解析內部訊息細節。

### 主題與顏色模式 (Theme & Color Mode)

模組會依據以下優先順序決定主題：

1. Frontmatter `config.theme`（單篇覆寫）
2. `useMermaidTheme()` 設定的手動模式（若有）
3. `@nuxtjs/color-mode`（安裝時自動偵測）：
  - `dark` → 使用 `theme.dark`
  - `light` → 使用 `theme.light`
4. 解析後的 `loader.init.theme`（套件預設為 `'default'`）

更多進階手動控制（如：強制指定特定主題、自訂切換邏輯），請參閱 [手動主題控制指南](./docs/ch/MANUAL_THEME_CONTROL.md)。

### 以 frontmatter 覆寫單頁設定

每篇 Markdown 都可以透過於 frontmatter 中加入 `config` 欄位來覆寫模組設定。

> **⚠️ 若要使用 frontmatter `config` 覆寫，務必在 `content.config.ts` 的 collection schema 中宣告 `config` 欄位。**  
> 若未宣告，Nuxt Content 不會將 `config` 解析為 JSON 物件，覆寫將無法生效。

在 `content.config.ts` 加上：

```ts
import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: '**',
      schema: z.object({
        config: z.record(z.unknown()).optional(), // 宣告 config 欄位
      }).passthrough(),
    }),
  },
})
```

接著在 Markdown frontmatter 使用：

````markdown
---
title: 單篇覆寫 Mermaid 設定範例
config:
  theme: forest
  flowchart:
    htmlLabels: false
---

```mermaid
flowchart LR
  A["<b>允許 HTML labels？</b>"] --> B{不允許}
```
````

### `%%{init}%%` 語法、frontmatter 與模組設定的優先順序

Mermaid 本身也支援在圖表內透過 `%%{init: ...}%%` 語法覆寫設定，例如：

````markdown
```mermaid
%%{init: { 'theme': 'forest', 'flowchart': { 'curve': 'step' } }}%%
graph TD
  A[Input] --> B{Valid?}
  B -- Yes --> C[Persist]
  B -- No  --> D[Error]
```
````

> 細節可參考 [Mermaid 官方文件](https://mermaid.js.org/config/directives.html#declaring-directives)

實際生效時的優先順序如下：

1. **圖表內的 `%%{init: ...}%%`** —— 最優先，直接由 Mermaid 處理。  
2. **frontmatter `config`** —— 深度合併在模組的 `loader.init` 之上。  
3. **模組層級的 `contentMermaid.loader.init`** —— 專案的全域預設。  

### Mermaid Inline attrs 與 YAML Frontmatter

支援三種方式控制 Mermaid Svg 的渲染：inline attrs、Mermaid YAML frontmatter、`%%{init}%%` 指令。

#### Inline attrs（fence info）

在 `mermaid` fence 上使用 inline attrs，傳遞 wrapper props 或設定 Mermaid 的 YAML 欄位（包含 `toolbar` 的 title/fontSize 與 `toolbar.buttons.*`）。

````markdown
```mermaid {title="Diagram A" toolbar='{"title":"My Diagram","fontSize":"14px"}' config='{"theme":"dark"}'}
graph TD
  A --> B
```
````

#### Mermaid YAML frontmatter（block 內）

把 Mermaid 的 YAML frontmatter 放在 code block 最前面，用來影響 SVG 輸出（例如 title、displayMode、config），也可以提供 `toolbar` 給 wrapper 元件（包含 `toolbar.buttons.copy: true`）。

````markdown
```mermaid
---
title: Sample Flowchart
displayMode: compact
config:
  theme: dark
toolbar:
  title: "Sample Diagram"
  buttons:
    copy: true
    expand: true
    fullscreen: false
---
graph TD
  A --> B
```
````

#### `%%{init}%%` 指令（block 內）

使用 Mermaid directive，直接在圖表定義內設定渲染選項。

````markdown
```mermaid
%%{init: { 'theme': 'forest', 'flowchart': { 'curve': 'step' } }}%%
graph TD
  A --> B
```
````

### 自訂渲染元件 (Custom Component)

若需完全接管 Mermaid 的渲染行為（例如：加入外框、Expand/Collapse 功能），可指定 `components.renderer`。

指定的名稱在元件解析完成前只是候選。解析期間 Built-in Renderer 會保持暫停；若找不到或無法載入該元件，模組才會回退到 Built-in Renderer。一旦解析成功，Custom Renderer 就完全擁有渲染流程，之後的 mount 或 render failure 不會觸發 Built-in fallback。

1. 在 `nuxt.config.ts` 中指定元件名稱：

   ```ts
   contentMermaid: {
     components: {
       renderer: 'MyCustomMermaid',
       spinner: 'MySpinner', // 選填：傳入自訂渲染元件
     },
   }
   ```

2. 在 `components/MyCustomMermaid.vue` 中實作：

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

Custom Renderer 會收到既有的 `code`、default slot 與 `spinner` 輸入；不會收到 Built-in 的設定、主題、toolbar、loading 或 error state。`components.error` 只處理 Built-in Mermaid render failure，因此 Custom Renderer 必須自行呈現錯誤狀態，如上例所示。

目前被設定為 `components.renderer` 的元件不得渲染 `<Mermaid>`：巢狀元件會再次選中同一個 Custom Renderer。請改為直接呼叫 `$mermaid()`、其他 rendering library 或自己的 renderer。

### 元件使用方式

可以用 `<Mermaid>` 自己包一個的 Vue 元件 。
例如，你可以同時放入標題、Loading 與錯誤顯示，之後就能在任意模板重複使用：
```vue
<!-- WrapperMermaid.vue -->
<template>
  <section>
    <header v-if="title">{{ title }}</header>

    <Mermaid>
      <slot>
        <pre><code>{{ code }}</code></pre>
      </slot>

      <template #loading>
        <component :is="spinner" v-if="spinner" />
        <p v-else>Diagram loading…</p>
      </template>

      <template #error="{ error, source }">
        <p>渲染失敗：{{ error instanceof Error ? error.message : String(error) }}</p>
        <pre><code>{{ source }}</code></pre>
      </template>
    </Mermaid>
  </section>
</template>
```

```vue
<!-- 使用範例 -->
<WrapperMermaid
  title="Demo Diagram"
  spinner="MySpinner"
>
  <pre><code>graph TD; A-->B; B-->C; C-->A</code></pre>
</WrapperMermaid>
```

可依需求調整此模式，把常用的 slot 寫在一個可重用的包裝元件中。

### 錯誤處理

當 Mermaid 解析或渲染失敗時，`<Mermaid>` 會觸發 `error` slot，並可透過 `components.error` 指定全域錯誤元件。兩者都會拿到錯誤內容與原始 Mermaid 定義，方便除錯。

```vue
<Mermaid>
  <pre><code>graph TD; A-->B; B-->C; C-->A</code></pre>

  <template #error="{ error, source }">
    <p>渲染失敗：{{ error instanceof Error ? error.message : String(error) }}</p>
    <details>
      <summary>查看原始定義</summary>
      <pre><code>{{ source }}</code></pre>
    </details>
  </template>
</Mermaid>
```

若想一次註冊、全域套用自訂錯誤畫面，可在設定中指定元件名稱：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  contentMermaid: {
    components: {
      error: 'MermaidError', // 全域註冊的元件名稱
    },
  },
})
```

## 相容性

公開 peer contract 支援 Nuxt `^4.1.0` 與 Nuxt Content `>=3.5.0 <4.0.0`。發布前會驗證兩個固定的 package artifact profiles：位於公開最低版本的 `v3-minimum`，以及刻意固定已知最新版本的 `v3-known-latest`。兩者都會在各自的精確 Node runtime 下驗證 clean installation、公開型別、production build 與基本瀏覽器 SVG rendering。

這兩個 profiles 是完整 peer range 的代表性證據，不是唯一支援版本清單。如果 profile 失敗，必須診斷並修復相容性邊界；不能靠刪除 profile 或降低 Package User assertions 取得綠燈。

請在各 profile 的精確 Node runtime 下執行：

```bash
volta run --node 22.19.0 pnpm test:compatibility-profile --profile v3-minimum
volta run --node 24.19.0 pnpm test:package-artifact
```

## 支持專案

如果這個模組對你有幫助，歡迎透過 [Ko-fi 支持我的開源工作](https://ko-fi.com/barzhsieh)。你的支持將協助專案持續維護、相容性更新、測試與文件撰寫。

## 貢獻

歡迎提交 Issue 回報問題或建議新功能！也歡迎直接發 Pull Request。

- Commit 訊息請遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式（例如 `feat: add spinner option`、`fix: handle dark mode toggle`）。
- PR 請附上變更摘要與測試結果。

<details>
<summary>開發指令</summary>

```bash
pnpm install        # 安裝依賴
pnpm dev:prepare    # 建置模組 stub 並準備 playground
pnpm dev            # 啟動 playground
pnpm test           # 執行測試
pnpm test:package-artifact # 驗證 known-latest package artifact profile
pnpm lint           # 執行 ESLint
pnpm test:types     # 型別檢查
```

</details>

## 授權

[MIT License](./LICENSE)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@barzhsieh/nuxt-content-mermaid/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@barzhsieh/nuxt-content-mermaid
[npm-downloads-src]: https://img.shields.io/npm/dm/@barzhsieh/nuxt-content-mermaid.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npmjs.com/package/@barzhsieh/nuxt-content-mermaid
[license-src]: https://img.shields.io/npm/l/@barzhsieh/nuxt-content-mermaid.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@barzhsieh/nuxt-content-mermaid
[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
