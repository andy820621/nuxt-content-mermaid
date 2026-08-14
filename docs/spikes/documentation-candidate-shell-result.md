# Documentation Candidate Shell Spike Result

## Outcome

**Overall: FAIL — use a thin Nuxt + Nuxt Content shell.**

Attempt 3 produced `PASS` for Questions 1, 2, 3, 4, and 6, and one candidate-caused `FAIL` for Question 5. The valid plain-static-host harness served the ordinary route's correct prerendered HTML with status `200`, but Docus changed that direct route to `Page not found` during client hydration. The failure reproduced on every JavaScript-enabled direct load and did not occur with JavaScript disabled or with client-side navigation from the homepage. It is attributable to the fixed Docus candidate shell's route/hydration behavior, not to registry, network, browser installation, pnpm policy, execution environment, or verifier availability.

The mandatory rule therefore selects the thin Nuxt + Nuxt Content shell. This is not a conditional or hybrid Docus result. No spike file is promoted, and this result does not begin production implementation or create implementation tickets.

## Attempt History

- **Attempt 1 — BLOCKED, no shell decision.** The first disposable install did not yet have a valid spike-local pnpm lifecycle policy, so no candidate judgment was formed.
- **Attempt 2 — BLOCKED, no shell decision.** Questions 2, 3, and 6 passed. Questions 1, 4, and 5 were blocked because self-closing MDC swallowed the next-step link, the ordinary route was not explicitly prerendered, and three spike-only verifier assumptions produced false negatives. No candidate-caused failure was observed.
- **Attempt 3 — FAIL, use the thin shell.** The owner-approved MDC, explicit Nitro route, public-seam scanner, browser selector, artifact metadata, and `better-sqlite3` corrections were applied to a clean reinstall of the same fixed candidate. The corrected harness exposed the candidate-caused direct-route hydration failure recorded here.

Attempt 3 was the final automatically authorized rerun. No Attempt 4 is initiated.

## Execution Context and Fixed Candidate

| Fact | Observed value |
| --- | --- |
| Executed | `2026-08-14T13:31:06+0800` (`2026-08-14T05:31:06Z`) |
| Repository commit | `f8918ba616ba958f51894747be55448b86df3dc1` |
| Node | `v24.19.0` |
| pnpm | `10.24.0` |
| npm / npx | `11.17.0` / `11.17.0` |
| OS | `Darwin 25.5.0 arm64` |
| Playwright / Chromium | `1.62.1` / `151.0.7922.34` |
| Execution mode | One sequential executor; no subagents dispatched. |

Node and pnpm are observed execution-environment facts, not candidate pins. Node satisfied `>=22.19.0`. The fixed candidate remained:

| Package | Exact version | Registry SRI |
| --- | ---: | --- |
| `docus` | `5.12.3` | `sha512-v5CF/Ta3+aAzuUKwPsFwSSCACXh9QRWbBZENwUyheajATnPrSnql+oHbDzANM+GBwDvmPpCBhzHsjKrdZZR0cw==` |
| `nuxt` | `4.5.2` | `sha512-tR3fcqeHlHmmkLMpIg3V7Y+1ltr302lW8djMw/iy+myfo7QSSz+BVJDuQhg5j73b9oteSyBfOKTDYTgvMtj6TA==` |
| `@nuxt/content` | `3.15.2` | `sha512-jBK48RbA5RIt2SdtHPBcu4eX8+PYVsspbN+Cfx52kbpl8uXCiwjFudqGZrl2yqRQuEqVDYk9FGIOvWiMarLDtA==` |
| `@barzhsieh/nuxt-content-mermaid` | `3.0.0` | `sha512-kEruFkDptMGvmqS+XAB7lQS8CEaC5BAZOjJc/TINDXOFAeUlAkDDGBmAkLEI9L4XbI8jmMUlspjRel5At90v0Q==` |
| `better-sqlite3` (disposable native dependency) | `12.5.0` | `sha512-WwCZ/5Diz7rsF29o27o0Gcc1Du+l7Zsv7SYtVPG0X3G/uUI1LqdxrQI7c9Hs2FWpqXXERjW9hp6g3/tH7DlVKg==` |

The one-project disposable workspace used `linkWorkspacePackages: false`, `preferWorkspacePackages: false`, and `strictDepBuilds: true`. `pnpm root -w` resolved inside the disposable directory. Root workspace approvals were neither read as policy input nor changed. The minimum lifecycle policy was:

```yaml
onlyBuiltDependencies:
  - better-sqlite3
  - esbuild

ignoredBuiltDependencies:
  - vue-demi
```

Both allowlisted packages appeared in the isolated dependency graph, `better-sqlite3@12.5.0` built successfully, and `pnpm ignored-builds` reported `Automatically ignored builds during installation: None`. Neither `dangerouslyAllowAllBuilds` nor `pnpm approve-builds` was used.

## Six Question Results

| # | Result | Causal attribution and observable evidence |
| --- | --- | --- |
| 1. Static homepage and ordinary content route | **PASS** | `nuxt prepare`, `nuxt typecheck`, and `nuxt generate` exited `0`. Static output contained `/index.html`, `/spike/ordinary.html`, and `/spike/ordinary/index.html`; the generated verifier inventoried `/`, `/spike/ordinary`, and `/spike/ordinary/`. A plain Python static server returned `200` for both intended direct routes, and their initial HTML contained `Candidate Shell Spike` and `SPIKE-ORDINARY-ROUTE`. No application server, rewrite, or fallback supplied either page. |
| 2. One Contract Demo from the exact stable registry artifact | **PASS** | Exact registry specifier, isolated lockfile SRI, lockfile SHA-256, disposable virtual-store realpath outside repository source, installed manifest name/version, and the existing registry-smoke all passed. A JavaScript-enabled homepage contained exactly one visible `[data-contract-demo] svg.flowchart`, proving the installed stable artifact hydrated the sole Contract Demo. |
| 3. Readable and copyable Mermaid source without JavaScript | **PASS** | With JavaScript disabled, homepage status was `200`; `details[data-mermaid-source]` and `pre code` were visible. Rendered text and programmatic selection both exactly equaled the committed `.mmd` source, including `SPIKE-MERMAID-SOURCE-SENTINEL`. |
| 4. Homepage adoption path through documented public seams | **PASS** | The hydrated homepage rendered purpose, fit, compatibility, Contract Demo, and next-step markers in order, with exactly one `/spike/ordinary/` anchor. Clicking it reached the ordinary route and retained `SPIKE-ORDINARY-ROUTE`. The corrected seam verifier exited `0`: exact authored allowlist matched, and private imports, bypasses, exact copied Docus source, component/layout overrides, forks, and patches were all absent. Manual review covered every authored file. |
| 5. Intended static-hosting boundary | **FAIL** | **Candidate-caused.** Serving only `.output/public`, a direct JavaScript-enabled request to `/spike/ordinary/` returned status `200` and initially displayed `SPIKE-ORDINARY-ROUTE`, then hydration reproducibly replaced it with `Page not found` and logged `Hydration completed but contains mismatches.` The same direct URL remained correct with JavaScript disabled, and the generated payload identified the content path as `/spike/ordinary`. The browser verifier exited `1` on this exact post-hydration heading assertion; an independent repeat reproduced the transition. Thus the candidate output cannot keep a required direct static route functional through hydration without an additional route-normalization workaround, which this spike forbids. |
| 6. Disable or leave incidental capabilities non-contractual | **PASS** | Public configuration disabled MCP, GitHub integration, and assistant controls. `/mcp` and `/__docus__/assistant` returned real `404`; assistant-control and GitHub-link counts were `0`; no external requests occurred. Agent Skills, `llms.txt`, `llms-full.txt`, Studio, MCP output, and assistant output were absent. Remaining static search/content dumps, raw Markdown, sitemap, robots, OG assets, payloads, and hashed assets were inventoried as non-contractual and introduced no request-time service. Seam review found no fork, patch, private import, or private workaround. |

## Shell Direction

**FAIL — use a thin Nuxt + Nuxt Content shell.**

The causal gate is satisfied: the registry artifact, runtime, package-manager policy, Chromium installation, plain static server, and relevant assertions were valid; the failure reproduced only when the fixed candidate hydrated a direct trailing-slash content route. One candidate-caused `FAIL` is sufficient under the accepted non-hybrid decision rule. This direction is a replaceable implementation choice, not a durable-spec change; production foundation work still requires a separately approved implementation ticket.

## Exact Artifact Identity Evidence

| Required evidence | Attempt 3 observation |
| --- | --- |
| Exact registry specifier | `@barzhsieh/nuxt-content-mermaid@3.0.0`; direct dependency specifier exactly `3.0.0` |
| Registry metadata | name `@barzhsieh/nuxt-content-mermaid`; version `3.0.0`; tarball `https://registry.npmjs.org/@barzhsieh/nuxt-content-mermaid/-/nuxt-content-mermaid-3.0.0.tgz` |
| Registry and lockfile SRI | `sha512-kEruFkDptMGvmqS+XAB7lQS8CEaC5BAZOjJc/TINDXOFAeUlAkDDGBmAkLEI9L4XbI8jmMUlspjRel5At90v0Q==` |
| Isolated lockfile importer | specifier `3.0.0`; value `3.0.0(95cf19d99f42ac1986ac16797c3a65a2)`; package key `@barzhsieh/nuxt-content-mermaid@3.0.0` |
| Disposable lockfile SHA-256 | `0b40947e6b7054a7dbd048fe0d64bdafd9daa07e7d8685c4a13ae214cffc536b` |
| Resolved entry realpath | `/Users/Andy/Documents/Code/Nuxt/nuxt-content-mermaid/.spikes/documentation-candidate-shell/node_modules/.pnpm/@barzhsieh+nuxt-content-mermaid@3.0.0_95cf19d99f42ac1986ac16797c3a65a2/node_modules/@barzhsieh/nuxt-content-mermaid/dist/module.mjs` |
| Workspace substitution | Absent. The realpath was inside the disposable `.pnpm` store, outside root `src/`, root `dist/`, and `playground/`; the isolated resolution contained no `workspace:`, `link:`, or source-root path. |
| Installed manifest | name `@barzhsieh/nuxt-content-mermaid`; version `3.0.0` |
| Hydrated runtime | Exactly one visible `[data-contract-demo] svg.flowchart` on the JavaScript-enabled homepage |

The corrected spike-only artifact verifier exited `0`. It made separate exact npm queries for `version`, `dist.integrity`, and `dist.tarball`, then matched them to the lockfile and installed package. The repository's existing `registry-smoke` also exited `0` with Node, install, build, runtime, and cleanup stages passed for version `3.0.0` and the same SRI. No production release verifier was modified and no second release-verification system was created.

## Commands and Verification Summary

| Command or command group | Exit | Key observation |
| --- | ---: | --- |
| `node --version`; `pnpm --version`; `npm --version`; OS/architecture and registry probes | `0` | Node `24.19.0`, pnpm `10.24.0`, npm `11.17.0`, Darwin `25.5.0 arm64`, npm registry selected. |
| Separate `npm view <exact-spec> version`, `dist.integrity`, and `dist.tarball` queries for all fixed packages | `0` | Every exact version and SRI matched; no version floated. An earlier malformed zsh loop was discarded as invalid evidence and did not affect attribution. |
| `pnpm --dir .spikes/documentation-candidate-shell install --reporter=append-only` | `0` | Clean install resolved the fixed candidate; `better-sqlite3@12.5.0` lifecycle completed. |
| `pnpm --dir ... install --frozen-lockfile`; `pnpm --dir ... ignored-builds`; dependency listing | `0` | Lock replay was reproducible; no unreviewed build was blocked; both minimum allowlist packages were present. |
| `pnpm --dir ... exec playwright install chromium` | `0` | Chromium `151.0.7922.34` was available. |
| `pnpm --dir ... run verify:artifact` | `0` | Registry, lockfile, realpath, manifest, and SRI proof passed. |
| `node scripts/release-verification/release-workflow.mjs registry-smoke --version 3.0.0 --integrity <exact-SRI>` | `0` | Existing clean-consumer install, build, runtime, and cleanup stages passed. |
| `pnpm --dir ... run prepare:nuxt`; `run typecheck`; `run generate` | `0` | Nuxt `4.5.2` generated static output and prerendered 15 routes. A preceding `run prepare` typo exited `1` before candidate execution because that script does not exist; it is an executor invocation error, not candidate evidence. |
| `pnpm --dir ... run verify:generated` | `0` | Target HTML routes and static incidental files matched the bounded inventory. |
| `pnpm --dir ... run verify:seams` | `0` | Exact authored list, public imports, copied-source review, and forbidden-workaround checks passed. |
| `pnpm --dir ... run verify:browser` | `1` | Valid candidate assertion failed: direct ordinary route became `Page not found` after hydration. |
| Independent Playwright reproduction with JS on/off and direct/client navigation | `0` | Direct JS load: correct heading then `Page not found`; direct no-JS and client navigation: correct ordinary heading. Homepage SVG/source/adoption/capability assertions passed. |
| Root `pnpm test` before and after the disposable run | `0`, `0` | Each run passed `45` files and `420` tests; final duration `84.88s`. Existing Nuxt warnings only. |

The JavaScript-disabled browser intentionally cancelled script fetches with Playwright reason `csp`; these expected browser-policy cancellations were local and were not treated as candidate network failures. They do not affect the exact no-JavaScript visibility/selection observations.

## Generated Route, Request, and Incidental Capability Inventory

Generated verifier inventory:

- Intended pages: `/` and `/spike/ordinary/`.
- Equivalent emitted HTML paths: `/spike/ordinary` and `/spike/ordinary/`.
- Framework/static status pages: `/200` and `/404`.
- Total public files: `298`.
- Non-hashed static outputs: `index.html`, `200.html`, `404.html`, `robots.txt`, `sitemap.xml`, root and ordinary payload JSON, two Content SQL dumps, two raw ordinary-Markdown paths, ordinary `.html` and `index.html`, two OG images, and two local OG font files.
- Hashed client assets: `281` files under `_nuxt/`.

Plain-server/browser inventory:

- `/`, `/spike/ordinary/`, their payloads, and all observed assets were served only from `.output/public`.
- `/__spike_missing_route__`, `/mcp`, and `/__docus__/assistant` each returned a real `404` with no redirect.
- The final compact capture observed `578` request events and `324` completed responses across JS/no-JS homepage and ordinary-route loads; every completed response was local status `200`, with `0` external requests and `0` page errors.
- JavaScript-enabled direct ordinary load emitted one hydration-mismatch console error and rendered `Page not found`; that is the Question 5 candidate failure.
- JavaScript-disabled contexts produced `125` local script cancellations with reason `csp`, as expected when scripts are disabled; semantic HTML remained readable.
- MCP, assistant API output, `llms.txt`, `llms-full.txt`, Studio, and Agent Skills output were absent. Search UI, Content dumps/raw output, sitemap, robots, OG assets, payload/build metadata, and hashed assets remain incidental and non-contractual.

## Public-Seam Record

The authored allowlist contained exactly twelve files: app config; one app-owned content component; homepage and ordinary Markdown; one `.mmd` source; Nuxt config; disposable package/workspace policy; and four spike-only verifier scripts. Candidate implementation files imported only the app-owned raw `.mmd` source plus public package/module identifiers. Mechanical and manual review found:

- no private or layer-internal Docus import;
- no fork, `patch-package`, patch metadata, or copied private implementation;
- no component/layout override (omitted as a bounded scope choice, without claiming documented same-name overrides are inherently private);
- no workaround that bypassed a documented public seam;
- no modification to the durable specification or `CONTEXT.md`.

The public seams used were Docus layer extension, Nuxt module registration, Nuxt/Nitro config, Docus app config, Nuxt Content Markdown/MDC, one app-owned auto-discovered content component, and a Vite `?raw` source import. The verifier scripts were reviewed but excluded from the raw private-substring scan, as approved; they remained spike-only.

## Root Preservation

The protected repository files retained their initial SHA-256 values:

| Path | SHA-256 |
| --- | --- |
| `package.json` | `52543c4971b348e94c3765473944d08a7d00ecd7ea0bab9c9faa249be67990bd` |
| `pnpm-workspace.yaml` | `28acfc6b1ee28a63633ef08745d547850660fc4c6aa2dce86eb68ccf537b0550` |
| `pnpm-lock.yaml` | `7aedacb4bfbd929387d09f334251761014b6f0102348659108188455276c4a91` |
| `.npmrc` | `1cf445caa9452da6f460c72e8777c9d5452caa4d02f0f6a17717bce818a0a3bc` |
| `nuxt.config.ts` | `c7fe7411efaa9350c5561feac41b42446c80499f0d9939aac7e6e85a05de374a` |
| `content.config.ts` | `b2a5a733bc03a69e32e812bf025fab5d88b968149c7006da0824ef11d32ccf8b` |
| `CONTEXT.md` | `1dff354d23cdc829c8fafe128691758d139f9cda69ee68c5a5ffb8c90087ffbb` |
| `docs/specs/documentation-website.md` | `a4c6c432494946755af5bbf2600d0bf13077f4bab89af63a4d18940701754e5a` |

After final cleanup, the owner's pre-existing staged diff SHA-256 remained `f1e8ae8bc626dfdb94506825a0d59188a3fe3cf352490e0cfda3ef7d678650ad`; the unstaged diff excluding the approved plan and result remained the empty SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. No tracked `playground/` file changed. `.spikes/` was absent. Final `git status --short` contained only the owner's staged `CONTEXT.md` and durable specification plus the staged-and-now-revised plan and canonical result; no unrelated staged or unstaged change was altered.

## Replaceable Choices and Unresolved Non-Contract Details

Later planning must know, but must not implement without separate approval:

- The selected shell direction is a thin Nuxt `4.5.2` + Nuxt Content `3.15.2` shell; the exact future shell package versions remain a separately approved implementation choice.
- Docus `5.12.3` is rejected only as this tested candidate. A future Docus version would require a new explicitly approved spike; this result does not authorize one.
- Homepage composition (Markdown/MDC versus an app-owned Nuxt page), the `.mmd` production location, source-disclosure styling, incidental static capabilities, and final visual design remain replaceable.
- Production directory/layout, information architecture, domain, deployment workflow, complete route manifest, content migration, Reference system, accessibility suite, and complete Contract Demo set remain unresolved.
- All four verifiers and all raw JSON/screenshots/lockfile data were execution-only. Promotion of any verifier or prototype file requires separate explicit approval.

None of these details changes the accepted product contract, durable specification, or `CONTEXT.md`.

## Prototype Disposition

**Default removal completed.** After this self-contained result was recorded, the complete `.spikes/documentation-candidate-shell/` directory—including installed packages, isolated lockfile, generated output, screenshots, raw JSON, and verifier files—was moved to the recoverable Trash path `/Users/Andy/.Trash/documentation-candidate-shell-attempt3-final-20260814T133200`. The empty `.spikes/` directory was removed. Raw evidence is execution-only; this document does not depend on the Trash path and contains no dead evidence reference. No spike file was promoted, no implementation ticket was created, and no production foundation was started.
