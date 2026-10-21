# 4.x 相依與遷移契約

> **即將推出的 4.x 契約；4.0 尚未發布。** 目前 npm 正式版為 3.0.5，綁定 Mermaid 11。本契約於發布後適用於升級至 4.x 的套件使用者。

本文件是 `@barzhsieh/nuxt-content-mermaid` 4.x 對套件使用者的公開 Compatibility Contract。[3.x 契約](./DEPENDENCY_AND_MIGRATION_CONTRACT.md)保留為歷史契約；變更詳見 [v4 遷移指南](./MIGRATION_V4.md)。

## 相依與瀏覽器邊界

請使用 Node.js `>=22.19.0`、`nuxt@^4.1.0` 與 `@nuxt/content@>=3.5.0 <4.0.0`。宿主需求與 3.x 相同。Nuxt 與 Content 仍是套件使用者擁有的 peers；所有已宣告範圍內的非 prerelease 版本都是 Declared-Compatible Combination。新的 peer major 需要明確驗證及後續套件更新。

Mermaid 是 Module-Owned Dependency，綁定為 `mermaid@~12.2.0`；請勿只是為了本模組而另裝 Mermaid。新安裝可取得 Mermaid 12.2 的 patch，但新的 minor／major 必須由套件明確更新。相容性不代表每個相容上游版本都安全；請維持應用程式 lockfile 與安全工具，使用已修補的宿主版本。

依 [Mermaid 12.2 固定版本需求](https://github.com/mermaid-js/mermaid/blob/1fb7869866dd619168d840291c9c54b4f129758b/packages/mermaid/src/docs/config/usage.md#L27-L33)，瀏覽器門檻為 ES2024／Safari 17.4+，包含 iOS／iPadOS 17.4+。4.x 是本套件首次明確宣告瀏覽器最低版本；3.x 未明列 Safari 最低版本，也未保證所有舊瀏覽器。提高的是 Mermaid 11 升至 12 的上游需求。舊瀏覽器不在此契約內。語法轉譯不會提供 `Object.groupBy` 等 API；選擇舊環境的應用程式必須自行提供並驗證轉譯／polyfill。目前的 Playwright 引擎證據不等於真實 Safari 17.4 或 iOS 實機驗證。

## 設定與遷移邊界

模組預設 `layout: 'dagre'`、`look: 'classic'`，並明確設定 `mindmap.layout: 'cose-bilkent'` 與 `swimlane.layout: 'swimlane'`，避免頂層 layout 覆蓋這兩種圖的原生預設；使用者可覆寫以上各項。Default／dark 主題策略，以及既有 Runtime、Page、Direct Mermaid Config 的傳輸、驗證、合併與隔離語意繼續適用。Page 與 Direct 設定仍互斥。

Mermaid 12 公開型別移除 `flowchart.defaultRenderer`、`class.defaultRenderer` 與 `state.defaultRenderer`，object literal 可能產生 TS2353。在該圖種的區段內選擇 `layout: 'dagre'` 或 `layout: 'elk'` 可保留舊的按圖種範圍；設在頂層則套用到該範圍內所有支援的圖種（runtime 初始化涵蓋整個應用程式，Page config 涵蓋該頁，Direct config 涵蓋該元件實例）。執行期傳輸會保留這些 Mermaid 擁有的鍵，但引擎忽略它們。開發模式每個「來源 × 欄位」在整頁載入期間只提示一次；production 移除警告。不提供自動轉換或型別相容層。

應用程式的 `^3.x` 範圍不會自動取得 4.x 或 Mermaid 12。請明確切換 4.x 並遵循遷移指南。公開型別變窄需要 major，此版也採用首次明列的瀏覽器門檻；geometry 不決定版本號。

## 套件擁有的渲染行為

綁定引擎成功渲染時，Built-in Renderer 會依 transactional rendering contract commit 可用的 SVG。Mermaid 載入或渲染失敗時，適用套件擁有的 error 與 fallback semantics。除上述遷移外，已文件化的 Nuxt／Content activation、Markdown transformation、configuration transport、public types、theme、toolbar、lazy rendering、extension 與 styling hooks 保持原語意。

契約排除 Mermaid input acceptance、精確 SVG serialization／element order、未文件化 DOM／class／generated identifier、layout、geometry、coordinates、dimensions、font measurement、Mermaid internals，以及每個圖表功能的完整正確性。維持視覺快照時，請自行控制應用程式 lockfile、瀏覽器、字型與 viewport。錯誤原始碼的 CSS 可見性問題另外追蹤於 [#145](https://github.com/andy820621/nuxt-content-mermaid/issues/145)。

## 3.x Frozen Policy

4.0 發布後，3.x 成為供 Nuxt 4 使用的 Frozen Legacy Release。既有 npm 版本仍可安裝，不會自動 deprecated，但不再更新相依、擴張相容性、增加功能或提供一般修正。

4.0 發布後前三個月是 Migration Assistance Window，優先處理遷移文件、使用指引，以及阻礙遷移的 4.x 缺陷。由套件引起的嚴重安全問題，可個別考慮低風險 backport，但不重啟一般 3.x 維護。若有大量 3.x 需求證據，可考慮延長協助，但不預先承諾。
