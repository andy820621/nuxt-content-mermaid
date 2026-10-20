# 升級至 v4

第 4 版綁定 Mermaid `~12.2.0`。這次採用 major，是因為 Mermaid 公開設定型別移除了 `defaultRenderer`，且瀏覽器門檻提高至 ES2024／Safari 17.4+。Layout、geometry 與 dimensions 仍在套件渲染契約之外。

Node.js `>=22.19.0`、Nuxt `^4.1.0` 與 Nuxt Content `>=3.5.0 <4.0.0` 不變。4.0 發布後，安裝 `@barzhsieh/nuxt-content-mermaid@^4` 才會切換至新引擎；應用程式的 `^3.x` 範圍**不會**自動取得 Mermaid 12。

## 將 defaultRenderer 改為 layout

請從三種設定來源移除 `flowchart.defaultRenderer`、`class.defaultRenderer` 與 `state.defaultRenderer`：

| 來源 | 修改位置 |
| --- | --- |
| Page Mermaid Config | Markdown 頁面的 `config` frontmatter／`pageConfig` prop |
| Direct Mermaid Config | 元件的 `config` prop |
| Runtime Mermaid Config | `contentMermaid.loader.init` 或對應的公開 runtime 設定 |

原本的 `'dagre-wrapper'` 改成頂層 `layout: 'dagre'`；`'elk'` 改成頂層 `layout: 'elk'`。其他圖種選項留在原物件內。

```yaml
# 修改前：Page Mermaid Config
config:
  flowchart:
    defaultRenderer: elk
    htmlLabels: false
```

```yaml
# 修改後
config:
  layout: elk
  flowchart:
    htmlLabels: false
```

Direct Mermaid Config：

```vue
<Mermaid :config="{ layout: 'elk' }" :code="code" />
```

執行階段預設值：

```ts
export default defineNuxtConfig({
  contentMermaid: {
    loader: { init: { layout: 'dagre', look: 'classic' } },
  },
})
```

Mermaid 12 在執行期會直接忽略舊鍵。本模組保留輸入，並在開發模式對每個「**來源 × 欄位**」於整頁載入期間只提示一次；多張圖或重新 render 不會重複提示。Production 建置會移除警告。模組不會自動轉換，因此只保留舊 `'elk'` 值不再能選用 ELK。

本模組預設 `layout: 'dagre'` 與 `look: 'classic'`，使用者可以覆寫。既有 default／dark 主題策略不變；只有圖表選用 `layout: 'elk'` 時才載入 ELK。

## 修正設定 literal 的 TS2353

Mermaid 12 的型別不再接受舊欄位。例如 `{ flowchart: { defaultRenderer: 'elk' } } satisfies PageMermaidConfig` 會產生 TS2353（未知屬性）。請改成 `{ layout: 'elk' } satisfies PageMermaidConfig`。Direct Mermaid Config 與 `loader.init` 使用相同修法；請勿以型別轉換掩蓋遷移需求。本套件不提供舊欄位的型別相容層。

## 檢查讀者的瀏覽器

Mermaid 12 的目標為 ES2024／Safari 17.4+，包含 iOS／iPadOS 17.4+（[上游需求](https://github.com/mermaid-js/mermaid/blob/1fb7869866dd619168d840291c9c54b4f129758b/packages/mermaid/src/docs/config/usage.md#L27-L33)）。iOS／iPadOS 17.4 於 [2024-03-05](https://support.apple.com/en-us/HT214081) 發布；macOS Safari 17.4 於 [2024-03-07](https://support.apple.com/en-us/120894) 發布。停留在舊系統的讀者，可能需要更新 OS 才能取得受支援的 Safari。舊瀏覽器即使能顯示部分圖表，也不在此契約內。

語法轉譯與 API polyfill 解決不同問題；降低 build target 不會補上缺少的 API。正式建置的瀏覽器測試移除 `Object.groupBy` 後，flowchart 仍能渲染，但 usecase parser 載入失敗。模組將失敗處理為圖表錯誤，周圍頁面內容與 Vue 互動仍正常。對延遲載入模組注入 SyntaxError，也能進入圖表錯誤處理。這些測試不是舊版 Safari 的等效模擬，不能保證整個應用程式的相容性。

需要支援更舊瀏覽器的應用程式，必須自行提供並驗證所需轉譯／polyfill，或保留 3.x。尚未驗證真實 Safari 17.4 與 iOS 實體裝置。錯誤 slot 的原始碼可能被既有 CSS 裁切；此獨立限制追蹤於 [#145](https://github.com/andy820621/nuxt-content-mermaid/issues/145)。

## 檢查圖表尺寸

Dagre／classic 預設保留原有呈現方向，但 Mermaid 12 仍可能改變間距、標籤、SVG 尺寸與 geometry。請檢查有尺寸限制的版面，並更新應用程式自己的視覺快照。精確 SVG 與 geometry 不屬於套件相容性保證。

## 3.x 凍結

4.0 發布後，3.x 仍可安裝，但不再更新相依、擴張相容性、增加功能或提供一般修正。前三個月優先提供遷移文件、使用指引，以及阻礙遷移的 4.x 缺陷修正。由套件引起的嚴重安全問題，會個案考慮 backport。詳見 [4.x 相依與遷移契約](./DEPENDENCY_AND_MIGRATION_CONTRACT_V4.md)。
