# Stable Release Verification Contract

## 目的

本規格定義 3.x stable release 的最小可靠模型：

`annotated tag → 一個 publish job → 一個 tarball → npm → GitHub Release`

Tag 是版本發布的起點與不可任意改寫的事實紀錄。驗證器只回答一個問題：
「這個即將發布的 tarball，能否被真實 Package User 安裝、建置並完成基本
Mermaid SVG rendering？」

## 邊界

本規格涵蓋：

- release tag、package version 與 changelog 的身分一致性；
- Publishable Package Artifact 的建立與驗證；
- npm Trusted Publishing／OIDC；
- npm 成功後建立 GitHub Release；
- 失敗時的不可變 recovery 原則。

本規格只保留 tag-driven publication 所需的單一 job 與人工 recovery；網站部署
仍使用獨立流程。

## 發布身分

Stable release tag 必須：

1. 是 `vX.Y.Z` 格式的 exact stable SemVer；
2. 是 annotated tag，而非 lightweight tag；
3. 指向 workflow checkout 的 exact commit；
4. 與 `package.json` 的 `X.Y.Z` 相同；
5. 在 `CHANGELOG.md` 有 exact `## vX.Y.Z` heading。

任一條件不成立即在 pack 或 npm access 前 fail closed。Tag 一旦推送不得
force-move；若已揭露確定性缺陷，修正後使用下一個 patch version。

## 驗證 CLI

Repository-internal CLI 介面固定為：

```text
node scripts/release-verification/package-artifact.mjs \
  --profile <id> \
  [--artifact-directory <absolute-empty-directory>]
```

- `--profile` 必填，且必須對應一個固定 Version Profile。
- 未提供 artifact directory 時，CLI 建立 managed temporary directory，完成後
  無論成功或失敗都清理，供 PR CI 與本機使用。
- 提供 artifact directory 時，路徑必須為 absolute；目錄可不存在，但建立後
  必須為空。成功後保留其中唯一 `.tgz` 給 release workflow 發布。
- 每次 invocation 只允許執行一次 `pnpm pack`。
- verifier runner 直接接收 `{ artifact, profile }`，不支援 registry 或其他
  package source adapter。

## Publishable Package Artifact

Artifact identity 至少包含：

- package name 與 exact version；
- archive filename 與 absolute path；
- SHA-256；
- `pnpm pack --json` 回報的 packlist。

允許內容僅限 `dist/**` 與 npm metadata（`LICENSE`、READMEs、`package.json`）。
Archive entry 不得為 absolute path、含 `..`、重複，或逃離 `package/` root。
Artifact manifest 必須符合 package-owned Node、Nuxt、Nuxt Content、Kit 與
Mermaid dependency contract；所有 public export 與 declaration target 必須是
archive 內存在的 package-owned file。

`pnpm pack` 產生的同一 `.tgz` 必須依序被 verifier 與 `npm publish` 使用。兩者
之間不得再次 pack，也不得透過 upload/download 或 checksum sidecar 重建身分。

## Version Profiles

固定 profiles 定義於 `scripts/release-verification/profiles.mjs`：

| Profile | Node | 目的 |
| --- | --- | --- |
| `v3-minimum` | `22.19.0` | 保護公開相容範圍下界 |
| `v3-known-latest` | `24.19.0` | 驗證目前刻意支援的最新固定組合 |

PR CI 在各自 exact Node runtime 執行兩個 profiles。Tag workflow 在固定 Node
`24.19.0` 執行 `v3-known-latest`，驗證即將交給 npm 的實際 tarball。Profiles
是固定 evidence，不是 exhaustive support matrix，也不在 release 時動態解析
registry latest。

## 驗證 stages

單一 artifact runner 依序執行：

1. `node-runtime`：profile 的 exact Node 與 runner 相同。
2. `artifact`：建立隔離 workspace，記錄 package 與 SHA-256 identity。
3. `archive`：驗證 archive safety、manifest contract、contents 與 public targets。
4. `install`：以 tarball file URL 與 profile exact versions 建立 fresh Package User application。
5. `exports`：從安裝後 package root 驗證 public exports。
6. `types`：驗證 Package User 可見型別。
7. `build`：執行 fresh Package User application production build。
8. `runtime`：以 Chromium 完成基本 browser SVG smoke。
9. `cleanup`：清理隔離 workspace。

任何 stage 失敗都記錄 evidence、跳過其後依賴 stages，並仍嘗試 cleanup。原始
失敗優先於 cleanup failure；若只有 cleanup 失敗，整體仍失敗。

## Publish workflow

`.github/workflows/publish.yml` 的精確檔名是 npm Trusted Publisher contract 的
一部分。Workflow 只接受 push `v*` tag，使用 release concurrency 且
`cancel-in-progress: false`，並只包含一個 `publish` job。

Job 必須：

- checkout 完整 history；
- 使用 Node `24.19.0`、npm `11.17.0`、Corepack `0.35.0` 與 repository-pinned
  pnpm；
- `pnpm install --frozen-lockfile`；
- 安裝 Playwright Chromium；
- 在 `$RUNNER_TEMP/release-artifact` pack 並驗證唯一 tarball；
- 以 `npm publish <exact-tarball> --access public --tag latest --ignore-scripts
  --provenance` 發布；
- 不提供 `NPM_TOKEN` 或 `NODE_AUTH_TOKEN`，以 `id-token: write` 使用 OIDC；
- npm 成功後，使用 `contents: write` 建立 matching GitHub Release。

## 完成條件

以下條件全部成立才算 release 完成：

- tag、package version、npm exact version 與 GitHub Release tag 相同；
- npm `latest` 指向該 exact version；
- npm package 顯示 provenance；
- GitHub Release 不是 draft 或 prerelease；
- tracking Issue 留下 npm、workflow、GitHub Release links 後關閉。

## Recovery

| 狀況 | 處理 |
| --- | --- |
| PR／tag 前驗證失敗 | 在原分支修正並重跑完整驗證。 |
| npm 前的暫時性基礎設施失敗 | 對同一 tag rerun workflow。 |
| npm 前的確定性 source／artifact 缺陷 | 保留 tag；修正 `main` 並準備下一個 patch。 |
| `npm publish` 結果不明 | 先查 exact version；不存在才 rerun，已存在則不得再 publish。 |
| npm 成功、GitHub Release 失敗 | 對既有 tag 執行 GitHub Release 步驟，不 rerun publish。 |
| 已發布 package 有缺陷 | Deprecate exact version，修正後發布新 patch；不得 overwrite 或 unpublish。 |
| 外部身分衝突 | 立即停止並人工核對；不得 force tag 或假定成功。 |
