# 3.x 相依與遷移契約

本文件是 `@barzhsieh/nuxt-content-mermaid` 3.x 對套件使用者的公開契約。它界定您提供的相依、套件提供的相依、2.x 遷移的含義，以及不在渲染保證範圍內的結果。

## 相依邊界

請使用 Node.js `>=22.19.0`、`nuxt@^4.1.0` 與
`@nuxt/content@>=3.5.0 <4.0.0`。這些是 3.x 確切的公開需求。

Nuxt 與 Nuxt Content 是由套件使用者擁有的 peer dependencies。請在您的應用程式安裝與更新它們，並維持 lockfile 與安全性工具為最新狀態。所有位於已發布 peer 範圍內的非 prerelease 版本都是 Declared-Compatible Combination；未來的 Nuxt 或 Nuxt Content major，必須等後續套件版本明確加入才受支援。

Mermaid 是 Module-Owned Dependency。套件會綁定並解析
`mermaid@~11.16.1`；請勿只是為了滿足本模組而另行安裝 Mermaid。tilde 範圍可接受 Mermaid 11.16 內的 patch release；Mermaid 的 minor 或 major 則需要明確的套件更新。

Compatibility 不等於 Security Recommendation。舊版 Nuxt 或 Nuxt Content 即使仍在 peer 範圍中，仍可能尚未修補或不適合用於正式環境。請以受上游維護的版本，以及應用程式的 lockfile、Dependabot 與安全性工具做出決定。

## 從 2.x 遷移

3.0 發布後，2.x 仍會是可安裝、供 Nuxt 3 使用的 **Frozen Legacy Release**，不會自動標示為 deprecated。凍結線不再接收相依更新、相容性擴張、新功能或一般修正。

3.0 發布後的前三個月是 **Migration Assistance Window**。在此期間，維護者會優先處理遷移文件、使用指引，以及阻礙遷移的 3.x 缺陷。這不是一般 2.x 維護，也不承諾 backport。對於由套件引起的重大安全性問題，可能個別評估低風險 backport，但不會因此重啟 2.x 線。

遷移至 3.x 時，請先將應用程式升級至上述需求、安裝 3.x 套件、把所有仍在使用的 `mermaidContent` 設定改為 `contentMermaid`，並遵循完整的 [v3 遷移指南](./MIGRATION_V3.md)。特別是，請將 `contentMermaid.enabled` 保留在 Nuxt 設定，且每張圖只能使用 Page Mermaid Config 或 Direct Mermaid Config 其中一種來源。

## 套件擁有的渲染行為

套件保證由其整合 seam 所掌控的行為。若綁定的 Mermaid engine 成功渲染圖表原始碼，Built-in Renderer 會依 transactional rendering contract commit 可用的 SVG；若 Mermaid 失敗，則適用套件擁有的 error 與 fallback semantics。文件化的 Nuxt 與 Content activation、Markdown transformation、configuration transport、public types、theme、toolbar、lazy rendering，以及文件化的 extension 或 styling hooks，都會保有已說明的行為。

這不保證 Mermaid 接受每一種輸入，也不保證每一種 Mermaid 圖表皆正確。契約同時排除精確 SVG serialization 或 element order、未文件化的 DOM、class、generated identifier、layout、geometry、coordinate、dimension、font measurement、Mermaid internals，以及每個 Mermaid feature 的完整正確性。

若您需要穩定的 visual snapshot，請自行控制 dependency lockfile、browser version、font、viewport 與相關 execution environment。請勿將精確 Mermaid 輸出視為套件的公開保證。
