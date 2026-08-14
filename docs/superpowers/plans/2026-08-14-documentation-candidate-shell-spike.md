# Documentation Candidate Shell Spike Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` sequentially to execute this plan task-by-task. Do not dispatch parallel subagents: one executor owns the disposable package, lockfile, generated output, and evidence directory for the entire run. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine, with reproducible external evidence and no production website work, whether the current canonical Docus package can satisfy the accepted documentation-website invariants through public extension seams.

**Architecture:** Build one disposable, isolated Docus consumer under `.spikes/` with one homepage, one ordinary content route, and one Contract Demo. Pin both Docus and the documented stable package artifact exactly, generate static output, exercise that output from a plain file server with JavaScript both enabled and disabled, and make one non-hybrid shell decision according to the evidence rules: six `PASS` results select Docus, any candidate-caused `FAIL` selects a thin Nuxt + Nuxt Content shell, and `BLOCKED` results without a candidate-caused `FAIL` select neither.

**Candidate Stack:** Docus 5.12.3, Nuxt 4.5.2, Nuxt Content 3.15.2, `@barzhsieh/nuxt-content-mermaid` 3.0.0, Playwright Chromium, and Nitro static generation. Node and pnpm are observed execution-environment facts, not fixed candidate inputs; record their exact versions on every run.

## Global Constraints

- This is only a bounded candidate-shell spike. It must not start production website implementation.
- Do not migrate the canonical README or migration content.
- Do not build the complete V1 information architecture, route manifest, Reference system, accessibility suite, deployment workflow, or Contract Demo set.
- Create exactly one Contract Demo.
- Do not configure a production domain or select a production hosting provider.
- Do not fork Docus, use `patch-package`, copy private Docus files, import private Docus paths, or bypass a public extension seam.
- Do not modify `docs/specs/documentation-website.md` or encode Docus into any durable specification.
- Preserve the user's staged changes to `CONTEXT.md` and `docs/specs/documentation-website.md`.
- Treat the existing playground as unsuitable artifact evidence because `playground/nuxt.config.ts` loads `../src/module` directly.
- Tests assert externally observable output, installed-artifact identity, and documented public seams rather than Docus implementation details.
- Classify each question as `PASS`, `FAIL`, or `BLOCKED`. `FAIL` is reserved for a candidate-caused failure in a valid, reproducible harness; registry, network, browser installation, package-manager policy, execution-environment, and verifier failures that prevent a valid judgment are `BLOCKED`.
- Six `PASS` results select Docus. Any candidate-caused `FAIL` selects a thin Nuxt + Nuxt Content shell. One or more `BLOCKED` results with no candidate-caused `FAIL` produce no shell decision; correct the harness/environment and rerun. There is no conditional or hybrid Docus result.

---

## Owner-approved Attempt 3 harness corrections

Attempt 3 is the last automatically authorized rerun. It preserves every product boundary and candidate version above and changes only the following known harness defects:

1. Author the single Contract Demo with documented top-level MDC block syntax:

   ```md
   ::contract-demo
   ::

   [SPIKE-NEXT-STEP: Open the ordinary content route](/spike/ordinary/)
   ```

   The blank line after the closing delimiter keeps the next-step link outside the component slot. Generated homepage evidence must contain the five ordered markers and a real anchor to `/spike/ordinary/`.
2. Decouple route emission from crawler discovery through the standard public Nitro seam: set `nitro.prerender.routes` to exactly `['/spike/ordinary']` and keep `crawlLinks: true`. The link remains mandatory Q4 evidence; the one explicit route independently supports Q1 and Q5. This is not a production route manifest, rewrite, handler, or private workaround.
3. Keep the complete authored-file allowlist, but scan actual candidate implementation surfaces and actual import/config/dependency specifiers for private seams. The four verifier scripts remain in the manual review and exact-copy audit but are excluded from raw private-import substring scanning. Do not hide forbidden strings through splitting or dynamic construction.
4. Keep `data-contract-demo` on the app-owned component root and assert exactly one visible `[data-contract-demo] svg.flowchart`. Preserve every existing no-JavaScript, request, console, page-error, source-selection, endpoint, navigation, and 404 assertion.
5. Query npm 11 registry metadata separately for `version`, `dist.integrity`, and `dist.tarball`; the artifact verifier itself must exit `0` without a compensating diagnostic. Do not modify the repository production release verifier.
6. Change only the disposable `better-sqlite3` pin to exact `12.5.0`, subject to exact registry preflight, because it is the least change satisfying Nuxt Content `^12.5.0` and Docus `12.x`. Regenerate the disposable lockfile and record its new SHA-256.
7. Keep one canonical result at `docs/spikes/documentation-candidate-shell-result.md`. Retain concise Attempt 1 and Attempt 2 history, append Attempt 3, and derive the top-level outcome from Attempt 3 only.
8. Restore the newest safe disposable prototype, then remove `node_modules`, `pnpm-lock.yaml`, `.nuxt`, `.output`, and `.spike-evidence` before the full sequential rerun. Do not carry any earlier `PASS` forward without rerunning its assertion.
9. Preserve the original bounded scope: no candidate-version changes other than the disposable SQLite compatibility input; no second demo, production content/domain/workflow, durable-spec/`CONTEXT.md` edit, tickets, promotion, private seam, fork, patch, copied implementation, handler, or rewrite.
10. Apply the existing decision rule and stop. If Attempt 3 is `BLOCKED`, do not start Attempt 4. Six `PASS` selects Docus only as a replaceable implementation choice; a candidate-caused `FAIL` selects the thin shell; either outcome stops without `/to-tickets` or production implementation.

---

## 1. Fixed Inputs and Mental Model

The spike separates three independent claims:

1. **Shell claim:** Docus can produce the required static pages through its documented Nuxt layer, content, app-config, and custom-component seams.
2. **Artifact claim:** the Contract Demo executes `@barzhsieh/nuxt-content-mermaid@3.0.0` from the npm registry, not the identically named workspace package.
3. **Output claim:** the contents of `.output/public` are sufficient by themselves for direct-route HTML, browser hydration, Mermaid SVG, and a no-JavaScript source fallback.

Passing one claim cannot compensate for failing another.

### Evaluated candidate versions

These candidate inputs are fixed for this spike so the result is reproducible:

| Input | Exact value | Why |
| --- | --- | --- |
| Docus | `docus@5.12.3` | Current registry version observed on 2026-08-14; this is the candidate under evaluation. |
| Package artifact | `@barzhsieh/nuxt-content-mermaid@3.0.0` | Exact stable registry artifact identified by the current repository package version. |
| Nuxt | `4.5.2` | Current workspace catalog value. |
| Nuxt Content | `3.15.2` | Current workspace catalog value and a declared-compatible package peer. |
| better-sqlite3 | `12.5.0` | Attempt 3 disposable compatibility input: the least exact version satisfying Nuxt Content `^12.5.0` and Docus `12.x`. |

The planning environment observed Node `24.19.0` and pnpm `10.24.0`. They are not fixed inputs. Preflight must record the exact observed values and confirm that Node satisfies `>=22.19.0` and that the installed pnpm 10 release supports the spike-local `onlyBuiltDependencies`, `strictDepBuilds`, and `ignored-builds` policy. An incompatible or unverifiable runtime is `BLOCKED`, not `FAIL`; do not silently switch runtimes mid-run.

Registry metadata already observed while planning, and to be re-queried during execution:

- `docus@5.12.3`: `sha512-v5CF/Ta3+aAzuUKwPsFwSSCACXh9QRWbBZENwUyheajATnPrSnql+oHbDzANM+GBwDvmPpCBhzHsjKrdZZR0cw==`
- `@barzhsieh/nuxt-content-mermaid@3.0.0`: `sha512-kEruFkDptMGvmqS+XAB7lQS8CEaC5BAZOjJc/TINDXOFAeUlAkDDGBmAkLEI9L4XbI8jmMUlspjRel5At90v0Q==`

If either exact version is unavailable, cannot be downloaded, or cannot be matched to current registry integrity, do not float to another version. Record the affected questions as `BLOCKED` because the run cannot form valid artifact evidence; registry or network state is not a Docus failure.

### Public seams allowed by the spike

- Docus Nuxt layer: `extends: ['docus']`.
- Nuxt application configuration: `nuxt.config.ts`.
- Nuxt app configuration: `app/app.config.ts`.
- Docus/Nuxt Content routing from `content/index.md` and `content/spike/ordinary.md`.
- Nuxt Content custom components under `app/components/content/`.
- The package's documented global `<Mermaid>` component and `code` prop.
- Standard Nuxt/Nitro static generation and standard Vue SSR output.

The seam register in the final result must cite these public documents:

- [Docus installation and layer integration](https://docus.dev/en/getting-started/installation)
- [Docus project structure and content routes](https://docus.dev/en/getting-started/project-structure)
- [Docus app configuration](https://docus.dev/en/concepts/configuration)
- [Docus custom Nuxt components and pages](https://docus.dev/en/concepts/nuxt)
- [Docus documented component customization](https://docus.dev/en/concepts/customization)
- [Docus MCP disable switch](https://docus.dev/en/ai/mcp)
- The repository README's documented Mermaid wrapper example.

Docus documents some same-name component overrides as public customization seams. This spike does not need a component or layout override, so its authored-file scope prohibits creating either one; that is a bounded scope choice, not a claim that documented overrides are private architecture.

---

## 2. Files and Disposable Area

### Plan artifact created now

- `docs/superpowers/plans/2026-08-14-documentation-candidate-shell-spike.md` — this execution plan.

### Disposable files created only after approval

All executable spike code stays below `.spikes/documentation-candidate-shell/`:

```text
.spikes/documentation-candidate-shell/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── nuxt.config.ts
├── app/
│   ├── app.config.ts
│   └── components/content/ContractDemo.vue
├── content/
│   ├── index.md
│   └── spike/ordinary.md
├── contract-demos/
│   └── candidate-shell.mmd
├── scripts/
│   ├── verify-artifact-identity.mjs
│   ├── verify-generated-output.mjs
│   ├── verify-public-seams.mjs
│   └── verify-browser-output.mjs
└── .spike-evidence/                 # execution-only; deleted with the prototype
    ├── environment.json
    ├── registry-metadata.json
    ├── artifact-identity.json
    ├── generated-files.json
    ├── public-seams.json
    ├── browser-results.json
    ├── requests.json
    └── screenshots/
```

Generated `.nuxt/`, `.output/`, `node_modules/`, npm tarballs, extracted registry files, and browser binaries are disposable and must not be committed.

### Result retained after the spike

- `docs/spikes/documentation-candidate-shell-result.md` — the self-contained, evidence-backed final spike result. It is an implementation record, not a durable product specification and must not depend on local evidence paths that will be deleted.

### Root files that must remain unchanged

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `.npmrc`
- `nuxt.config.ts`
- `content.config.ts`
- everything under `playground/`
- `CONTEXT.md`
- `docs/specs/documentation-website.md`

The repository-root workspace files remain untouched. The disposable directory has its own nearest `pnpm-workspace.yaml`, whose only package is `.`, so pnpm never consults or modifies root workspace build approvals. `pnpm --dir "$SPIKE_ROOT" root -w` must resolve exactly to `$SPIKE_ROOT` before install proceeds.

---

## 3. Minimal Prototype Contract

### `package.json`

Create a private package with no floating direct dependencies:

```json
{
  "name": "documentation-candidate-shell-spike",
  "private": true,
  "type": "module",
  "scripts": {
    "prepare:nuxt": "nuxt prepare",
    "typecheck": "nuxt typecheck",
    "generate": "nuxt generate",
    "verify:artifact": "node scripts/verify-artifact-identity.mjs",
    "verify:generated": "node scripts/verify-generated-output.mjs",
    "verify:seams": "node scripts/verify-public-seams.mjs",
    "verify:browser": "node scripts/verify-browser-output.mjs"
  },
  "dependencies": {
    "@barzhsieh/nuxt-content-mermaid": "3.0.0",
    "@nuxt/content": "3.15.2",
    "better-sqlite3": "12.5.0",
    "docus": "5.12.3",
    "nuxt": "4.5.2"
  },
  "devDependencies": {
    "playwright": "1.62.1",
    "typescript": "5.9.3",
    "vue-tsc": "3.3.9",
    "yaml": "2.9.0"
  }
}
```

### `pnpm-workspace.yaml`

Create a one-project workspace inside the disposable directory. The allowlist is an explicit spike-local input for the evaluated Nuxt/Content graph; it is not read from or written back to the repository-root workspace:

```yaml
packages:
  - '.'

linkWorkspacePackages: false
preferWorkspacePackages: false
strictDepBuilds: true

onlyBuiltDependencies:
  - better-sqlite3
  - esbuild

ignoredBuiltDependencies:
  - vue-demi
```

Do not use `dangerouslyAllowAllBuilds` or `pnpm approve-builds`. `strictDepBuilds: true` makes any newly encountered, unreviewed lifecycle script stop the install instead of being silently skipped. Such a stop is an install-policy `BLOCKED`: review whether the package is actually necessary, update this spike-local allowlist only, record the package and rationale, and rerun from a clean disposable install. It is not a candidate `FAIL`. The final result must record the effective allowlist and confirm each allowed package appears in the isolated dependency graph; remove any entry that is not actually present before treating the install as valid.

### `nuxt.config.ts`

Use only declared Nuxt/Docus/module configuration:

```ts
export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@barzhsieh/nuxt-content-mermaid'],
  compatibilityDate: '2025-11-24',
  nitro: {
    compatibilityDate: '2025-11-24',
    prerender: {
      routes: ['/spike/ordinary'],
      crawlLinks: true,
    },
  },
  mcp: {
    enabled: false,
  },
})
```

Do not add aliases into `node_modules/docus`, custom Nitro handlers, route rewrites, Vite plugins, copied layouts, component/layout overrides, or layer-internal imports. Component/layout overrides are omitted because this spike does not require them, even though Docus documents some component overrides as public seams.

### `app/app.config.ts`

Use documented public switches only:

```ts
export default defineAppConfig({
  docus: {
    locale: 'en',
  },
  header: {
    title: 'Candidate shell spike',
  },
  github: false,
  assistant: {
    floatingInput: false,
    explainWithAi: false,
  },
})
```

The generate command also removes `AI_GATEWAY_API_KEY` and `VERCEL_OIDC_TOKEN` from the build environment, which is Docus's documented full-assistant disable condition. It removes `NUXT_SITE_URL` so the spike does not configure a production domain.

### Homepage and ordinary route

`content/index.md` contains only invented spike copy with five unique, ordered markers:

1. product purpose;
2. package fit;
3. compatibility boundary;
4. the single Contract Demo;
5. one next-step link to `/spike/ordinary/`.

It does not copy README or migration prose. `content/spike/ordinary.md` contains a unique ordinary-route heading and one short sentence. These markers make route and adoption-path assertions deterministic without becoming production content.

The Contract Demo uses a top-level `::contract-demo` / `::` MDC block, followed by one blank line and then the next-step Markdown link. The single explicit Nitro prerender route proves ordinary-route emission independently; crawler discovery remains enabled and the rendered link remains mandatory homepage evidence.

### One Contract Demo and one source of truth

`contract-demos/candidate-shell.mmd` contains one small valid flowchart with a unique source sentinel. `ContractDemo.vue` imports it once with Vite's public `?raw` support, normalizes line endings, and uses that same string for both outputs:

- `<Mermaid :code="encodeURIComponent(source)">` is the live runtime-backed diagram from the installed stable artifact.
- A sibling, semantic `<details open><summary>Mermaid source</summary><pre><code>…</code></pre></details>` retains the exact text as SSR HTML.

The source fallback sits outside the package renderer's wrapper so package CSS cannot visually clip it. It remains visible after hydration; progressive hiding is not part of this spike. The `contract-demos/` directory is neutral to the candidate app shell and can be relocated to a production-neutral asset seam only in later approved work.

---

## 4. Commands to Run

Run commands from the repository root. Use a task-specific variable; do not reuse system variables such as `HOME`.

```bash
SPIKE_ROOT="$PWD/.spikes/documentation-candidate-shell"
```

### Environment and preservation snapshot

```bash
git status --short --branch
git diff --name-only
git diff --cached --name-only
node --version
pnpm --version
uname -a
pnpm --dir "$SPIKE_ROOT" root -w
npm view docus@5.12.3 version --json
npm view docus@5.12.3 dist.integrity --json
npm view docus@5.12.3 dist.tarball --json
npm view @barzhsieh/nuxt-content-mermaid@3.0.0 version --json
npm view @barzhsieh/nuxt-content-mermaid@3.0.0 dist.integrity --json
npm view @barzhsieh/nuxt-content-mermaid@3.0.0 dist.tarball --json
npm view better-sqlite3@12.5.0 version --json
npm view better-sqlite3@12.5.0 dist.integrity --json
npm view better-sqlite3@12.5.0 dist.tarball --json
```

`pnpm root -w` must print the disposable directory. Record the exact Node, pnpm, OS, and registry values in execution-only JSON and embed them, with command exit statuses and key output, in the final result. If runtime compatibility, registry access, or metadata identity cannot be established, classify the affected questions as `BLOCKED`; do not classify Docus from this preflight. The executor must preserve the pre-existing staged `CONTEXT.md` and specification changes.

### Isolated install and reproducibility check

```bash
pnpm --dir "$SPIKE_ROOT" install --reporter=append-only
pnpm --dir "$SPIKE_ROOT" install --frozen-lockfile --reporter=append-only
pnpm --dir "$SPIKE_ROOT" ignored-builds
pnpm --dir "$SPIKE_ROOT" list better-sqlite3 esbuild --depth Infinity --json
pnpm --dir "$SPIKE_ROOT" exec playwright install chromium
```

The first command creates the disposable lockfile; the second proves it is sufficient. `ignored-builds` must report no required lifecycle package left blocked, and the dependency listing must show every allowlisted package in the isolated graph. The root workspace config, approvals, install state, and lockfile must not be read as policy inputs or changed. A registry/network error, browser-download error, unsupported pnpm policy, blocked lifecycle script, or native build failure attributable to the execution environment is `BLOCKED`. Do not add an approval automatically and do not use `dangerouslyAllowAllBuilds`.

### Existing package-artifact seam (bounded supporting check)

Reuse the repository's existing registry-smoke seam rather than creating a second release-verification system:

```bash
node scripts/release-verification/release-workflow.mjs registry-smoke --version 3.0.0 --integrity 'sha512-kEruFkDptMGvmqS+XAB7lQS8CEaC5BAZOjJc/TINDXOFAeUlAkDDGBmAkLEI9L4XbI8jmMUlspjRel5At90v0Q=='
```

This is a supporting cross-check of the already-published package and uses the repo's existing clean-consumer verifier; do not modify that verifier for this spike. Its release-specific `latest` precondition and Version Profile are not candidate-shell requirements. If either makes this supporting command inapplicable, record that fact without inventing a Docus failure; Question 2 remains judgeable only if all five required identity/runtime observations below are independently valid.

### Artifact-identity proof

```bash
pnpm --dir "$SPIKE_ROOT" run verify:artifact
pnpm --dir "$SPIKE_ROOT" list @barzhsieh/nuxt-content-mermaid --depth 0 --json
pnpm --dir "$SPIKE_ROOT" why @barzhsieh/nuxt-content-mermaid --json
shasum -a 256 "$SPIKE_ROOT/pnpm-lock.yaml"
```

`verify-artifact-identity.mjs` must fail unless all of the following hold:

1. The direct dependency specifier is the exact string `3.0.0`; it is not `workspace:`, `link:`, `file:`, a range, or a tag.
2. The disposable `pnpm-lock.yaml` importer records `3.0.0` and the package snapshot records the same exact version and registry integrity.
3. Separate fresh `npm view` queries for `version`, `dist.integrity`, and `dist.tarball` match the planned identity and lockfile integrity; the verifier must not depend on npm's multi-field JSON shape.
4. `import.meta.resolve('@barzhsieh/nuxt-content-mermaid')` resolves to `dist/module.mjs` inside the disposable package's `node_modules/.pnpm/` virtual store.
5. `fs.realpathSync()` of the resolved entry is inside the disposable registry installation and outside every canonical repository source root (`src/`, root `dist/`, and `playground/`) and every `link:`/`file:` target; the installed package manifest reports name `@barzhsieh/nuxt-content-mermaid` and version `3.0.0`.

The fifth necessary observation is the hydrated SVG produced by this exact resolved package in the one Contract Demo during the browser check. `verify-artifact-identity.mjs` is a thin, spike-only assertion adapter; it writes the exact resolved path, SRI values, manifest identity, lockfile hash, and boolean assertions to execution-only JSON. Do not add registry tarball extraction or publishable-file comparison to it. Promotion of this verifier requires separate explicit approval.

### Nuxt preparation, type check, and static generation

```bash
pnpm --dir "$SPIKE_ROOT" run prepare:nuxt
pnpm --dir "$SPIKE_ROOT" run typecheck
env -u AI_GATEWAY_API_KEY -u VERCEL_OIDC_TOKEN -u NUXT_SITE_URL pnpm --dir "$SPIKE_ROOT" run generate
pnpm --dir "$SPIKE_ROOT" run verify:generated
pnpm --dir "$SPIKE_ROOT" run verify:seams
```

`verify-generated-output.mjs` inventories and hashes `.output/public`, then verifies both page files, unique page markers, the next-step link, the literal Mermaid source text, and the absence of error-shell text. It records every additional generated route so incidental output is visible rather than silently accepted.

`verify-public-seams.mjs` first checks the exact authored-file allowlist (`package.json`, `pnpm-workspace.yaml`, `nuxt.config.ts`, `app/app.config.ts`, `app/components/content/ContractDemo.vue`, both Markdown routes, the `.mmd` source, and the four spike scripts). It scans actual candidate implementation files and parsed import/config/dependency specifiers, excluding the four verifier-policy implementations from raw private-import substring scanning while retaining them in the complete manual review and exact-copy audit. It then mechanically rejects only:

- imports from `docus/…`, `docus/app/…`, `#layers/…`, or any path below `node_modules/docus`;
- fork URLs, `patch-package` metadata, package patches/overrides aimed at Docus, and layer-internal imports;
- an explicit byte-for-byte copied Docus source file;
- a custom route rewrite, server handler, alias, or build hook that bypasses a documented public seam to make the candidate pass.

Do not use generic copied-source-signature detection. After the scan, manually review the complete authored-file diff against the installed Docus package, record the reviewed file list and conclusion, and confirm no private implementation was copied. A component/layout override is rejected here only because it is outside this spike's authored-file scope; the report must explicitly acknowledge that Docus documents some same-name component overrides as public customization seams. A scope-invalid harness is corrected and rerun; it is not evidence that Docus failed. The script writes its execution-only details to `.spike-evidence/public-seams.json`, while the final result embeds the authored-file list, import-scan result, manual-review conclusion, and official public-seam URLs.

### Browser and static-hosting checks

```bash
pnpm --dir "$SPIKE_ROOT" run verify:browser
```

`verify-browser-output.mjs` must:

1. Spawn `python3 -m http.server 4173 --bind 127.0.0.1 --directory .output/public` as a plain static server with no SPA fallback and terminate it in `finally`.
2. Confirm an unknown route returns 404, proving the harness is not masking missing generated pages.
3. Open `/` and `/spike/ordinary/` directly in a Chromium context with JavaScript enabled and record status 200, title/heading markers, and successful next-step navigation.
4. On `/`, assert exactly one visible `[data-contract-demo] svg.flowchart` and record its DOM presence and the absence of page/runtime errors; toolbar SVGs are not diagram candidates.
5. Repeat direct requests in a separate Chromium context with `javaScriptEnabled: false`.
6. In the no-JavaScript context, assert the source `<details>`, `<pre>`, and `<code>` are visible; the code text equals the trimmed `.mmd` file; and selecting its text yields that exact source. Playwright protocol evaluation may inspect the selection, but no page JavaScript is allowed to execute.
7. Record all requested URLs. Hydration must obtain every needed resource from `.output/public`; no request may depend on a Nitro server, `/mcp`, `/__docus__/assistant`, the playground, or the repository source tree.
8. Confirm `/mcp` and `/__docus__/assistant` return 404 from the static artifact and that assistant controls are absent.
9. Save JavaScript-enabled and no-JavaScript screenshots plus `.spike-evidence/browser-results.json` and `.spike-evidence/requests.json` as execution-only evidence. The retained result embeds the browser observations and request/route inventory; it must not cite these local paths after deletion. If raw files are uploaded as an issue or CI artifact, record the durable external artifact identifier and retention policy, but do not make the shell decision depend on that upload.

### Final preservation check

```bash
git diff -- package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc nuxt.config.ts content.config.ts playground CONTEXT.md docs/specs/documentation-website.md
git status --short --branch
```

Compare these outputs with the initial snapshot. The only permitted new durable files are this plan and, after execution, the final spike result. Existing user changes must be byte-for-byte preserved.

---

## 5. Observable Evidence and Decision Rules

Apply an attribution gate before assigning a result:

1. Confirm that registry/network access, runtime compatibility, the spike-local lifecycle policy, browser installation, and the relevant verifier are valid enough to judge the candidate.
2. Assign `PASS` only from the complete required evidence.
3. Assign `FAIL` only when the same failure is reproducible in that valid harness and the observed cause belongs to Docus, the candidate shell, or its documented public extension seam.
4. Assign `BLOCKED` when environment or verifier state prevents that causal judgment. Correct the harness/environment and rerun; do not reinterpret the block as a candidate failure.

| # | Spike question | Required observable evidence | PASS | FAIL — candidate-caused only | BLOCKED — no valid candidate judgment |
| --- | --- | --- | --- | --- | --- |
| 1 | Can the shell generate one homepage and one ordinary content route as static output? | `nuxt prepare`, `nuxt typecheck`, and `nuxt generate` command/exit records; generated homepage and ordinary-route HTML; a plain static server returns 200 for both direct routes; unique markers and route inventory prove each intended page. | Every item is observed with no fallback rewrite or server process beyond the static file server. | In a valid harness, Docus generation omits/corrupts either route, emits an error shell, or requires an application server for a direct route. | Runtime/install/generator/verifier/static-server environment prevents generation or reliable inspection. |
| 2 | Can it run one Contract Demo using the committed exact stable npm artifact without workspace substitution? | Exact registry specifier; isolated lockfile registry resolution and SRI; lockfile SHA-256; resolved realpath outside repository source roots; installed manifest name/version; visible hydrated SVG from that installed package. | All identity observations are valid and the one demo hydrates to SVG. | After exact registry identity is valid, the installed stable artifact cannot integrate with the candidate Docus shell or hydrate the one demo for a cause attributable to the candidate/package integration. | Registry/download/integrity evidence is unavailable; pnpm policy or workspace isolation is invalid; the resolved identity is unprovable/substituted; or the identity/browser verifier is itself unreliable. |
| 3 | Can generated output retain readable and copyable Mermaid source when JavaScript is unavailable? | Generated HTML contains literal source in semantic text nodes; a JS-disabled browser shows it; selected text exactly equals the `.mmd` source; browser observation is embedded in the result. | Source is visible, readable, selectable, and exact with page JavaScript disabled. | In a valid generated artifact/browser harness, candidate output stores source only in non-readable serialization, hides/clips it, changes it, or requires page JavaScript to reveal/copy it. | Chromium cannot be installed/launched, JS-disable behavior cannot be verified, or the browser verifier cannot establish visibility/selection accurately. |
| 4 | Can the homepage adoption path be customized through documented public extension seams? | Ordered purpose, fit, compatibility, Contract Demo, and next-step markers render from `content/index.md` plus the app-owned content component; exact authored-file/import audit and manual diff review pass; official seam URLs are embedded. | The minimal adoption sequence works using only content, app config, and the app-owned Nuxt Content component seam selected for this spike. | With the bounded public-seam implementation and a valid harness, Docus cannot express or render the required adoption sequence, or would require a private import, fork, patch, copied private implementation, or undocumented bypass. | The authored scope contains an unplanned component/layout override or other out-of-scope file, copied-source review is incomplete, public documentation cannot be verified, or the seam verifier is unreliable. Documented same-name overrides are not classified as private merely because this spike omits them. |
| 5 | Can output remain compatible with the intended static-hosting boundary? | Only `.output/public` is served; direct routes, assets, hydration, and no-JS output work; missing route is a real 404; route/request inventory shows no server/API state. | The public directory alone supplies all required behavior and no production domain/provider setting is needed. | In a valid harness, required candidate behavior depends on `.output/server`, an API route, request-time Content database, server middleware, host rewrite, or provider-only runtime. | Static-server/browser/request capture cannot reliably distinguish public files from application-server or provider behavior. |
| 6 | Can unnecessary incidental capabilities be disabled or left non-contractual without forks or private overrides? | Public config disables MCP and GitHub integration; build env and app config disable assistant; generated-route/UI/request inventory classifies every remaining capability; seam audit passes. | Every request-time or maintenance-bearing incidental capability is disabled/absent through a public seam; remaining static outputs are enumerated as non-contractual and add no process/hosting dependency. | In a valid harness, an unwanted capability cannot be disabled/left negligible through public seams, leaks a request-time dependency, forces domain/deployment work, creates a maintenance contract, or requires a fork/patch/private workaround to remove. | Capability inventory, public-switch verification, or request observation is incomplete because the harness/verifier cannot establish what remains. |

### Incidental-capability classification

The final result must classify each observed capability, not merely state that it is unnecessary:

| Capability | Required spike treatment |
| --- | --- |
| MCP server | Disable with documented `mcp.enabled: false`; `/mcp` absent from static output. |
| AI assistant | Remove auth environment, hide documented controls, and verify no assistant request or static control remains. |
| GitHub edit/report integration | Disable with documented `github: false`. |
| Agent Skills | Provide no `skills/` directory; record any generated static discovery file as incidental, but fail if it creates a request-time need. |
| `llms.txt` / `llms-full.txt` | May remain only as enumerated static, non-contractual output; do not configure a production domain. |
| Search | May remain a shell-provided convenience, but the spike and later plan must not promise completeness or add a search maintenance contract. |
| Sitemap, robots, OG assets | May remain static and non-contractual during the spike; no production URL, provider, or complete route-manifest promise is made. |
| i18n | Use only Docus's single-language `en` configuration; do not create translated routes or synchronization work. |
| Studio | Do not install or enable it. |

The accepted specification allows negligible incidental shell capabilities, but they remain replaceable and cannot become V1 guarantees by accidental presence.

---

## 6. Result Recording

Update the single canonical `docs/spikes/documentation-candidate-shell-result.md` only after every command that can safely run has completed, including a run that ends `BLOCKED`. Retain concise Attempt 1 and Attempt 2 history, append Attempt 3, and set the top-level outcome from Attempt 3 only. Do not create a second result file or commit an unfilled scaffold.

The result must contain:

1. execution date, repository commit, initial/final git status, Node version, pnpm version, OS, Chromium version;
2. exact evaluated candidate versions, exact registry specifiers, and current registry SRI values for Docus and the stable package artifact;
3. the complete command list with exit status and concise key output for each command, including install policy and effective `onlyBuiltDependencies`;
4. the isolated lockfile SHA-256, package lockfile registry resolution/SRI, resolved realpath, and installed manifest name/version;
5. the complete generated route inventory and concise JavaScript-enabled/no-JavaScript browser observations, including direct-route status, hydrated SVG, exact selectable source, 404 behavior, and request boundary;
6. one row per question with uppercase `PASS`, `FAIL`, or `BLOCKED`, factual causal attribution, and the embedded observation that supports it;
7. the selected shell direction, derived mechanically as follows:
   - six `PASS`: **PASS — use Docus**;
   - any candidate-caused `FAIL` (whether or not another question is `BLOCKED`): **FAIL — use a thin Nuxt + Nuxt Content shell**;
   - one or more `BLOCKED` and no candidate-caused `FAIL`: **BLOCKED — no shell decision; correct the harness/environment and rerun**;
8. the public-seam register, exact authored-file/import audit, and manual no-copied-private-source review;
9. the generated capability inventory, including every incidental static output and whether it was disabled, absent, or retained as non-contractual;
10. replaceable implementation choices later planning must know;
11. unresolved implementation details that do not alter the accepted product contract;
12. prototype disposition: removed, or separately approved and promoted as an intentional production foundation.

The result is self-contained. Raw JSON, the disposable lockfile, generated files, request logs, and screenshots are execution-only by default and may be deleted with `.spikes/`. If an issue or CI artifact retains them, include only a durable external identifier and retention note as supplementary material. Never leave a required assertion pointing at a deleted local `.spike-evidence`, lockfile, screenshot, or generated-output path.

### Replaceable choices to report

- The exact Docus evaluation pin and whether a later Docus upgrade requires re-running the spike.
- Whether the homepage uses Markdown/MDC only or an app-owned Vue page through the documented Nuxt seam.
- The always-visible source disclosure used by the spike; later visual treatment may change while semantic source remains.
- The location and import mechanism for the neutral Contract Demo source asset.
- Which static Docus outputs remain incidental and explicitly non-contractual.
- The exact public switches needed to keep request-time AI/MCP features absent.

### Non-contract-altering details to leave unresolved

- production directory name and final repository layout;
- hosting provider, deployment identity, production domain, and base URL;
- final visual design, Docus theme tokens, header/footer composition, and final homepage copy;
- complete V1 route manifest and information architecture;
- canonical README and migration-content movement;
- full Structured Reference storage and validation system;
- complete accessibility and quality suite;
- production deployment workflow and authority cutover;
- final Contract Demo subjects and the complete Contract Demo set;
- any future bilingual strategy.

---

## 7. Prototype Disposition

The result document is retained; generated output and spike code do not linger ambiguously.

### Default disposition

After the self-contained result has embedded required hashes, command outcomes, key output, route inventory, and browser observations, remove `.spikes/documentation-candidate-shell/` in full, including execution-only raw evidence. This keeps the bounded experiment from becoming an accidental production website or a second package workspace.

### Optional intentional promotion after a six-PASS result

Promotion is a separate, explicit approval after the spike result. If approved, move only reviewed foundation files into the selected production application directory:

- exact dependency manifest and independent lockfile;
- Nuxt/Docus public configuration;
- artifact-identity verifier;
- static-output and no-JavaScript browser checks;
- neutral Contract Demo asset boundary if its subject is intentionally adopted.

Do not promote spike copy, sentinel text, screenshots, `.output`, `.nuxt`, `node_modules`, unpacked tarballs, or raw temporary evidence. Any promoted file must lose the `spike` name, receive normal project ownership, and be recorded in the later production implementation plan.

### Failure disposition

On any candidate-caused `FAIL`, retain only the self-contained result, remove the complete disposable prototype, and make the next website plan target a thin Nuxt + Nuxt Content shell. Do not try a private Docus workaround after failure.

On `BLOCKED` with no candidate-caused `FAIL`, retain the self-contained result, remove the complete disposable prototype, make no shell selection, correct the named harness/environment defect, and rerun this same bounded plan. Do not convert registry, network, browser, lifecycle-policy, runtime, or verifier problems into Docus failures.

Attempt 3 is the final automatically authorized rerun. If it ends `BLOCKED`, remove the prototype and stop for owner review without initiating Attempt 4.

---

## 8. Scope and Consistency Review Before Handoff

- [ ] Every one of the six user questions maps to one evidence set and one three-state attribution rule.
- [ ] The prototype contains exactly one homepage, one ordinary content route, and one Contract Demo.
- [ ] No canonical README, migration content, production route system, domain, or deployment workflow is introduced.
- [ ] Exact registry identity is proven independently of pnpm's displayed version, or the affected question is explicitly `BLOCKED`.
- [ ] The no-JavaScript assertion proves visible/selectable text, not merely serialized source.
- [ ] Public-seam evidence is documented; private paths/bypasses are mechanically rejected; copied-source absence is confirmed by authored-file/import audit plus manual diff review.
- [ ] Static-host testing serves only `.output/public` and verifies a real missing-route 404.
- [ ] Incidental capabilities are individually disabled, absent, or explicitly non-contractual.
- [ ] Six `PASS` results select Docus; any candidate-caused `FAIL` selects the thin shell; `BLOCKED` without `FAIL` selects nothing and requires a rerun.
- [ ] Spike code is removed by default or promoted only after separate explicit approval.
- [ ] The durable specification remains unchanged.

## Approval Gate

Stop here. Do not create the disposable prototype, install dependencies, generate output, or run browser checks until the user approves this plan.
