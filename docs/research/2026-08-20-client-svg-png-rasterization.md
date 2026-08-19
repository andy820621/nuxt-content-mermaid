# Client-side SVG snapshot to PNG rasterization

**Date:** 2026-08-20
**Scope:** 已成功渲染的 Mermaid SVG snapshot；不重新呼叫 Mermaid、不修改使用者設定；輸出透明 PNG，並保留 `foreignObject` 與 web font 的瀏覽器呈現。

## 結論

公開資料無法保證任何純前端套件在所有 Safari/WebKit 情境都可靠；但本專案針對固定 `html-to-image@1.11.11` 建立的 bounded spike，已在 Chromium、Firefox、WebKit 通過目前明確定義的產品輸入契約：只點陣化同一份 sanitized Mermaid SVG snapshot、不重新執行 Mermaid、不修改 Mermaid 設定，並保留 `foreignObject`、中文、多行、粗體、non-system webfont、透明背景與精確尺寸。

這是**對已測 snapshot 與 gate 的實證**，不是對套件所有輸入的普遍保證。正式實作若採用，仍應固定精確版本、沿用相同失敗邊界，並把無法讀取的跨來源 stylesheet 或 CSS `@import` 視為明確錯誤，不能靜默輸出 fallback font 或改寫 live CSSOM。

`html-to-image@1.11.13` 仍不適用：同一最小 fixture 的既有 `foreignObject` 內容會消失，與上游 issue #520 的版本回報一致。因此本次證據只支持精確版本 `1.11.11`，不支持 semver range 或最新版。[issue #520](https://github.com/bubkoo/html-to-image/issues/520)、[latest release v1.11.13](https://github.com/bubkoo/html-to-image/releases/tag/v1.11.13)

### Bounded spike 實測結果

真實 faithful snapshot spike 已依修訂後的 perceptual gate 執行，結果**通過**：

- 固定輸入 SHA-256：`c717f5d969335af8dccf16ff8cc011491f3317137f054597a438e6adfffea493`
- 固定 `html-to-image@1.11.11`，沒有 Mermaid import、render 或設定修改。
- snapshot 含 11 個 `foreignObject`、9 個中文、8 個多行及 8 個粗體標籤；sanitizer preflight 確認無 script、event attribute、外部 reference 或外部 CSS URL。
- pixel hash 只保留作診斷；相鄰輸出逐像素比較，忽略每 channel ≤ 8 的差異，超過門檻的像素比例必須嚴格小於 0.01%。
- same-origin 與 anonymous CORS 兩種字型情境都在 Chromium、Firefox、WebKit 各連續三次通過；每次都是精確 1445×477、四角 alpha 皆為 0，並成功內嵌四個 Noto Sans TC font data URL。
- WebKit 第 1 次與後兩次的診斷 hash 不同，但兩組相鄰比較在 689,265 pixels 中都沒有任何像素的 channel delta 超過 8，因此符合 perceptual repeatability 契約。
- blocked stylesheet 在三引擎都於載入階段明確回報失敗，且沒有建立 PNG output source；沒有靜默使用 fallback font。
- Production correction 另確認 `html-to-image@1.11.11` 會以 `insertRule()` 將 `@import` 展開結果寫入 live stylesheet；因此正式 rasterizer 會在 library call 前明確拒絕 CSS `@import`。Chromium、Firefox、WebKit 的 readable same-origin import regression 都連續拒絕兩次，stylesheet rules、computed style 與 visible SVG markup 完全不變。[exact-version source](https://github.com/bubkoo/html-to-image/blob/v1.11.11/src/embed-webfonts.ts#L111-L143)
- 沒有加入 retry、delay、browser branch、Mermaid rerender、設定修改或 fallback output。

上述固定輸入、語意 gate、逐引擎結果與停止條件是本次 bounded spike 的持久研究紀錄。依此證據，production spec/plan 已決定精確採用 `1.11.11`；bounded spike 本身沒有修改 production code 或正式依賴。

## 心智模型：問題不在 Canvas，而在第二次 SVG image 載入

瀏覽器中的 Mermaid 圖已在主文件的 DOM、CSSOM 與 `FontFaceSet` 中完成排版。純前端 PNG 管線通常不是「截圖」，而是：

```text
已渲染 SVG DOM
  → clone / serialize
  → 當成一個新的 SVG image resource 載入
  → drawImage(canvas)
  → PNG
```

新的 SVG image resource 會進入較受限的 image processing mode：腳本與外部資源不可用，外部圖片、stylesheet、font 必須先內嵌成 `data:` URL。[SVG as an image 的限制](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)、[SVG 2 secure processing mode](https://www.w3.org/TR/SVG2/conform.html#processing-modes)

因此：

- `document.fonts.ready` 只代表**主文件**使用中的字型載入與 layout 完成，不會自動把字型 bytes 帶入新 SVG image resource。[`Document.fonts` 說明](https://developer.mozilla.org/en-US/docs/Web/API/Document/fonts)
- `foreignObject` 本身是跨瀏覽器的 SVG 功能，但「含 `foreignObject` 的 SVG 作為 `<img>` 再畫入 canvas」另有安全與 decode 差異，不能只用元素支援表推定可靠。[`foreignObject` 支援](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/foreignObject)、[WebKit canvas/foreignObject issue](https://bugs.webkit.org/show_bug.cgi?id=156176)
- 若不指定 canvas 背景，canvas 預設透明；透明不是主要風險，來源是否成功繪製及 canvas 是否仍 origin-clean 才是。[HTML Canvas 規格](https://html.spec.whatwg.org/multipage/canvas.html)

## 候選比較

| 方案 | 使用同一 snapshot、不重跑 Mermaid | Web font | `foreignObject` | 透明背景 | Chromium / Firefox / WebKit 證據 | 判斷 |
| --- | --- | --- | --- | --- | --- | --- |
| `html-to-image` | 是，但 API 型別以 `HTMLElement` 為主，SVG root 是特殊路徑 | `1.11.11` 會內嵌全部可讀 web fonts；新版 used-font traversal 不會進入 SVG subtree | 最新版本有既有 `foreignObject` 在 PNG 消失的 open regression；`1.11.11` 真實 snapshot spike 通過 | 未指定 `backgroundColor` 時不填色 | `1.11.11` 在本地三引擎通過 same-origin、anonymous CORS 與 perceptual repeatability gate | 只有精確 `1.11.11` 具備本次採用證據 |
| `dom-to-image-more` | 是；接受 `Node` 並遞迴 clone SVG/HTML | 等待 fonts、掃描並內嵌 `@font-face`；可選擇抓取跨來源 stylesheet | 其核心就是 foreignObject rasterization，也處理 Firefox 尺寸差異 | 未指定 `bgcolor` 時不填色 | 官方測 Chrome/Firefox；**明確不支援 Safari** | 最適合有限 spike，不可直接正式採用 |
| `html2canvas` | 可包住 snapshot，但會重新解析/重建 DOM 畫面，不是 screenshot | 沒有針對 SVG snapshot 的字型 bytes 內嵌保證 | SVG 預設仍被序列化成 image；另一個 FO renderer 是 experimental | `backgroundColor: null` 可透明 | README 列三大瀏覽器，但 SVG 缺失、字型錯誤等 open issue 仍存在 | 不採用 |
| 自行內嵌 `@font-face` + data URL → Image → Canvas | 是，且最少改寫 snapshot | 可解決「可讀 CSSOM、可 CORS fetch、有 URL bytes」的字型 | data URL 的 canvas taint interop 最佳，但 WebKit decode 穩定性仍未解 | 可可靠保留 | data URL origin-clean 有跨引擎共識；WebKit rendering/timing 仍缺可靠保證 | 架構最接近，但維護成本過高且仍未達三引擎保證 |

## 1. `html-to-image`

### 它怎麼做

`html-to-image` 會 clone DOM、內嵌 web fonts 與圖片、包入外層 SVG `foreignObject`、產生 data URL，再畫到 canvas；未指定 `backgroundColor` 時不主動填色。[官方流程](https://github.com/bubkoo/html-to-image#how-it-works)、[`toSvg` / `toCanvas` / `toPng` source](https://github.com/bubkoo/html-to-image/blob/master/src/index.ts#L15-L76)

它不會重跑 Mermaid，因此概念上可處理 snapshot。但它不是針對 SVG snapshot 設計的穩固介面：公開函式型別是 `T extends HTMLElement`；clone 遇到 SVG root 時直接保留 deep clone，不再逐層處理 SVG subtree。[API source](https://github.com/bubkoo/html-to-image/blob/master/src/index.ts#L15-L31)、[SVG clone 特例](https://github.com/bubkoo/html-to-image/blob/master/src/clone-node.ts#L75-L85)

### 版本與適用範圍

目前新版字型篩選只遞迴 `child instanceof HTMLElement`，所以從 SVG root 或包住 SVG 的 HTML root 開始時，不會走入 SVG subtree 去發現 `foreignObject` 內實際使用的 font family。即使它具備 font embedding，仍可能漏掉 Mermaid HTML label 使用的字型。[used-font traversal](https://github.com/bubkoo/html-to-image/blob/master/src/embed-webfonts.ts#L205-L247)、[font injection](https://github.com/bubkoo/html-to-image/blob/master/src/embed-webfonts.ts#L250-L273) `1.11.11` 尚未加入這個 used-font 最佳化，會處理所有可讀取的 `@font-face`，這也解釋了最小 probe 的版本差異。[`v1.11.11` font embedding source](https://github.com/bubkoo/html-to-image/blob/v1.11.11/src/embed-webfonts.ts#L190-L228)

更直接的阻擋證據是：最新 release `v1.11.13` 有一個仍開啟的 bug，明確回報「SVG 內既有 `foreignObject` 在 PNG 中不會渲染」，而 `v1.11.11` 可用。[issue #520](https://github.com/bubkoo/html-to-image/issues/520)、[latest release v1.11.13](https://github.com/bubkoo/html-to-image/releases/tag/v1.11.13)

README 雖寫著測過 Chrome、Firefox、Safari，但 Safari 仍有 first-call blank、SVG/cross-origin image 不出現等 open bug；這不足以支持「可靠 WebKit」。[README browser claim](https://github.com/bubkoo/html-to-image#browsers)、[Safari blank issue #488](https://github.com/bubkoo/html-to-image/issues/488)

**判斷：不採用最新版或 semver range。** 真實 snapshot bounded spike 已支持把精確 `1.11.11` 帶入 production spec/plan 決策；正式實作仍須保留明確的 CORS/font 失敗行為。

## 2. `dom-to-image-more`

### 它怎麼做

`dom-to-image-more` 的公開介面接受 `Node`。它會先等待主文件字型、遞迴 clone 每個 SVG/HTML child 並複製 computed style、內嵌 web fonts 與圖片，最後透過 data URL → image → canvas 輸出。[snapshot pipeline source](https://github.com/IDisposable/dom-to-image-more/blob/main/src/dom-to-image-more.js#L181-L244)、[遞迴 clone source](https://github.com/IDisposable/dom-to-image-more/blob/main/src/dom-to-image-more.js#L755-L904)

它的字型處理比 `html-to-image` 更適合 SVG snapshot：會掃描 `document.styleSheets` 的 `@font-face`，將 font URL 轉成 data URL CSS，再附加到 clone；也提供 `loadExternalStyleSheet` 與 `requestInterceptor` 處理讀不到的跨來源 stylesheet。[font embedding source](https://github.com/IDisposable/dom-to-image-more/blob/main/src/dom-to-image-more.js#L1233-L1241)、[font rule discovery source](https://github.com/IDisposable/dom-to-image-more/blob/main/src/dom-to-image-more.js#L2012-L2080)、[跨來源 stylesheet 選項](https://github.com/IDisposable/dom-to-image-more#loadexternalstylesheet)

PNG 預設不填 canvas，只有提供 `bgcolor` 才畫背景；它也顯式指定 `drawImage` 尺寸，以避開 Firefox 對含 `foreignObject` SVG intrinsic size 的差異。[PNG/canvas source](https://github.com/IDisposable/dom-to-image-more/blob/main/src/dom-to-image-more.js#L591-L704)

### 阻擋條件

官方 README 明確限定 Chrome 與 Firefox，並寫明 Safari 不支援，原因是 WebKit 的 `foreignObject` 安全模型與 image decode timing 可能產生空白或不穩定結果。[browser support](https://github.com/IDisposable/dom-to-image-more#browsers)、[Safari reliability note](https://github.com/IDisposable/dom-to-image-more#things-to-watch-out-for)

跨來源 stylesheet 的 `cssRules` 依法可能拋出 `SecurityError`；選擇重新 fetch stylesheet 仍需對方允許 CORS，否則只能略過並退回 fallback font。[CSSStyleSheet security restriction](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet)、[resource handling](https://github.com/IDisposable/dom-to-image-more#resource-handling-requestinterceptor-vs-corsimg-vs-imageplaceholder)

這個 fork 的最新 release `v3.10.2` 發布於 2026-07-10，維護狀態優於另外兩個候選，但「近期維護」不能抵銷其明文 WebKit 非支援。[v3.10.2 release](https://github.com/IDisposable/dom-to-image-more/releases/tag/v3.10.2)

**判斷：只推薦做有限 spike。** 若只需 Chromium/Firefox，它是最合理候選；在 WebKit 是正式門檻時，不可直接採用。

## 3. `html2canvas`

### 它不是實際 screenshot

`html2canvas` 官方文件明確說明：它會讀 DOM 與支援的 CSS，自己建立 canvas representation，不是瀏覽器畫面 screenshot，因此結果不保證 100% 相同。[官方說明](https://html2canvas.hertzen.com/documentation)

它遇到 SVG 時仍會用 `XMLSerializer` 轉成 data URL image；這與目前失敗的原生路徑具有相同的「新 SVG image resource」字型隔離問題，source 中沒有先把該 SVG 使用的 font bytes 內嵌。[SVGElementContainer source](https://github.com/niklasvh/html2canvas/blob/master/src/dom/replaced-elements/svg-element-container.ts)

`foreignObjectRendering` 預設為 `false`；打開時使用的 class 在 source log 中也自稱 `EXPERIMENTAL ForeignObject renderer`，其流程仍是把 clone 包進 FO、序列化成 data URL、再 `drawImage`。[configuration](https://html2canvas.hertzen.com/configuration)、[foreignObject renderer source](https://github.com/niklasvh/html2canvas/blob/master/src/render/canvas/foreignobject-renderer.ts)

雖然官方列出 Chrome、Firefox、Safari，但 SVG 不出現和 web font metrics/載入錯誤仍有 open issue；而最新正式 release `v1.4.1` 是 2022-01-22。[SVG issue #3175](https://github.com/niklasvh/html2canvas/issues/3175)、[font issue #1940](https://github.com/niklasvh/html2canvas/issues/1940)、[v1.4.1 release](https://github.com/niklasvh/html2canvas/releases/tag/v1.4.1)

`backgroundColor: null` 可以輸出透明底，但這不補足 SVG/FO/font 的核心問題。[configuration](https://html2canvas.hertzen.com/configuration)

**判斷：不採用。** 它的優勢是重建一般 HTML，而本功能已有完整 SVG snapshot；引入大型 DOM/CSS renderer 仍無法保證字型與 SVG fidelity。

## 4. 自行內嵌 `@font-face`，再走 data URL → Image → Canvas

### 可行的最小管線

1. 取得最後成功 committed snapshot 的 sanitized clone，不碰 visible DOM，也不呼叫 Mermaid。
2. 等待 `document.fonts.ready`，確保主文件中已使用的字型與 layout 完成。[FontFaceSet.ready](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet)
3. 從 CSSOM 收集相符的 `CSSFontFaceRule`，保留 family、weight、style、stretch、unicode-range 等 descriptors。
4. 將規則內每個可 fetch 的 font URL 解析成絕對 URL，以 CORS fetch 取得 bytes，轉為 `data:` URL，注入 snapshot clone 的 `<style>`。
5. 將 snapshot 中其他外部 image/CSS URL 一併內嵌；SVG image mode 不允許任意外部資源。[SVG image restrictions](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)
6. XML serialize 後使用**百分比編碼 data URL**載入 `Image`，不要以 Blob URL 作為唯一管線。
7. `await image.decode()`，畫到未填色 canvas，再用 `toBlob('image/png')`。

data URL 是較安全的跨引擎共同基線：Blink 的官方 intent 記錄指出，三個引擎都同意「含 `foreignObject` 的 data-URI SVG 不應 taint canvas」；Blob URI 則曾是 Gecko 可讀、Chromium/WebKit taint 的互通差異。[Blink intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/JpA2vmA9XT8/m/ZbcAIeq7AQAJ)

字型本身也適合轉成 data URL：CSS Fonts 規格要求跨來源 font 使用 CORS，並列出 data URL font 可視為 same-origin；沒有 `Access-Control-Allow-Origin` 的第三方 font 不能由這條管線重新取得。[CSS Fonts 4 font fetching requirements](https://www.w3.org/TR/css-fonts-4/#font-fetching-requirements)

### 仍無法可靠處理的情況

- **跨來源 CSSOM：** 外部 stylesheet 即使已套用到頁面，程式仍可能不能讀 `cssRules`；重新 fetch stylesheet 也需要 CORS。[CSSStyleSheet](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet)
- **`local()` / system font：** browser 可使用本機字型，但沒有標準 API 可把已安裝字型的 raw bytes 取出再內嵌。`FontFace` 可從 URL 或 `ArrayBuffer` 建立，並不提供反向匯出已載入 font bytes 的 API。[FontFace constructor](https://developer.mozilla.org/en-US/docs/Web/API/FontFace/FontFace)
- **script-created FontFace：** `Document.fonts` 能列出 `FontFace` 與載入狀態，但無法可靠還原建立它時的原始 URL/ArrayBuffer；只等待 `ready` 不等於可序列化它。[FontFaceSet](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet)
- **WebKit image decode：** 即使所有資源都已內嵌，現成套件仍記錄 Safari 可能首張空白或時序不穩；字型內嵌只能解決資源隔離，不能證明 WebKit rasterization 穩定。[html-to-image issue #488](https://github.com/bubkoo/html-to-image/issues/488)、[WebKit bug #156176](https://bugs.webkit.org/show_bug.cgi?id=156176)
- **CSP：** data image、inline style 或 font data URL 可能被使用者站點的 `img-src`、`style-src`、`font-src` 拒絕；module 無法也不應繞過主站 CSP。[CSP fetch directives](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
- **維護面：** 正確處理 nested `@import`、相對 URL、不同 font format、variable font descriptors、unicode-range、CSS escaping、同一 family 多 weight/style、CORS/credentials、timeout 與 canvas size，實質上是在維護一個縮小版 `dom-to-image-more`。

**判斷：暫不自行實作。** 這是最貼近 snapshot 語意的架構，但已超出單純「加 PNG」的合理維護範圍，而且 WebKit 仍沒有可靠證據。

## 安全與資料邊界

無論使用套件或自建管線，都應先從現有 standalone SVG sanitizer 取得 clone，再進行 font/image embedding，不能把未清理的 Mermaid HTML label 直接 attach 到 live DOM 或序列化。SVG image secure mode 會禁用 script 與外部 references，但這不是省略 sanitizer 的理由：同一份 snapshot 仍會用於可下載 SVG，而且套件可能建立暫時 DOM clone。[SVG secure static/animated modes](https://www.w3.org/TR/SVG2/conform.html#processing-modes)

跨來源資源只能採 anonymous CORS；不要由 module 自動攜帶 credentials 或代理第三方 URL。Canvas 一旦畫入不符合同源/CORS 的影像，`toBlob()` / `toDataURL()` 會因 tainted canvas 拋出 `SecurityError`。[MDN canvas/CORS](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image)

PNG canvas 應保持未填色；只有 SVG snapshot 自己存在背景形狀時才呈現不透明背景。`html-to-image` 與 `dom-to-image-more` 都是只有顯式指定背景 option 才填 canvas。[html-to-image source](https://github.com/bubkoo/html-to-image/blob/master/src/index.ts#L36-L58)、[dom-to-image-more source](https://github.com/IDisposable/dom-to-image-more/blob/main/src/dom-to-image-more.js#L645-L704)

## 建議的下一步與停止條件

研究 spike 已完成。下一步若決定正式採用，production spec/plan 應只收進已證明的邊界：

1. 精確固定 `html-to-image@1.11.11`，輸入既有 sanitized SVG snapshot；不改 Mermaid 設定、不呼叫 Mermaid、不接受 semver range。
2. hash 僅供診斷；repeated-output 使用目前核准的 perceptual pixel diff 契約。
3. 保留尺寸、透明度、內容、`foreignObject` 與 webfont gate；無法讀取或內嵌必要字型時必須中止下載並回報錯誤。
4. 跨來源 stylesheet/font 只接受 anonymous CORS；blocked resource 不可靜默 fallback。CSS `@import` 一律在 library call 前明確中止，以避免 pinned 版本改寫 live CSSOM。
5. 不加入 browser-specific retry、delay、重畫、魔術 timeout 或替代輸出。

本次仍未驗證站點 CSP、任意外部圖片、script-created `FontFace`、system/local font bytes 或所有 Mermaid diagram 類型；除非另立需求，不應把這些擴入目前 PR。

## 推薦順位

1. **若接受上述邊界：精確採用 `html-to-image@1.11.11`。** 它是唯一已用真實 snapshot 通過本專案三引擎 gate 的候選。
2. **不採用最新版 `html-to-image`。** `1.11.13` 有直接 `foreignObject` regression，本次證據不能外推到新版。
3. **不改用 `dom-to-image-more` 或 `html2canvas`。** 前者明文不支援 Safari，後者不是 screenshot 且沒有解決 SVG webfont 隔離。
4. **不自行維護 font embedder。** 除非另立功能與安全/CORS 支援範圍，否則成本不符合本 PR。
5. **若未來允許伺服器且前端方案遇到未涵蓋輸入：再決策 Puppeteer screenshot。** 不在目前實作範圍。
