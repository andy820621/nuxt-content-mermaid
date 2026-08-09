# Release Publication Boundary Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the ambiguous Git-push recovery holes before 3.0 by separating deterministic release preparation from human-controlled Git publication and an idempotent exact-tarball npm publication command.

**Architecture:** `release:prepare` owns source verification, isolated release-commit creation, one-time packing, frozen Minimum/Known-Latest artifact verification, and manual interaction verification; it stops with immutable `verified` evidence and never mutates formal `main`, tags, remotes, or npm. The maintainer performs a short ordinary-Git handoff and checks remote refs. `release:publish` then verifies local and remote refs against the frozen source commit, reconciles the exact npm version by `dist.integrity`, publishes only the retained tarball when absent, and runs Registry Smoke with the frozen Known-Latest profile.

**Tech Stack:** Node.js ESM, TypeScript declaration files, Vitest, pnpm, Git CLI, npm registry CLI, existing package-artifact and registry-smoke runners.

## Global Constraints

- This work must not tag, push, open a PR, publish to npm, or execute `pnpm release:publish` for a real version.
- Preserve every existing user change and the two dependency-contract commits already on `codex/v3-module-dependencies`.
- Keep exact-artifact publication: prepare and pack exactly once; publication must use the retained tarball path with lifecycle scripts disabled.
- Keep the 3.0 frozen profiles unchanged: `v3-minimum` and `v3-known-latest` are the only pre-publication artifact profiles.
- Registry Smoke must reuse the frozen `v3-known-latest` profile from release evidence; it must never resolve an `actual-latest` profile.
- Do not add automatic rollback, generalized resume/checkpoint machinery, GitHub API orchestration, or another distributed release state machine.
- Do not raise Nuxt, Nuxt Content, Node, or Mermaid version floors as part of this work.
- `.release-evidence` is ephemeral local evidence. A release-code or evidence-schema change invalidates it; do not migrate or reuse schema-v1 evidence.
- Keep the implementation in the existing release-verification module; do not split unrelated files or refactor package/runtime code.

## Target State Mental Model

The journal records facts owned by the script, not an inferred distributed transaction:

| Fact | Owner | Evidence state |
| --- | --- | --- |
| Source and retained artifact passed every gate | `release:prepare` | `verified` |
| Local `main`/tag and remote `main`/tag point to the source commit | Maintainer, rechecked by `release:publish` | no new journal status |
| npm exposes the exact version with matching `dist.integrity` | `release:publish` | `published` |
| Frozen-profile Package User smoke is healthy | registry-smoke runner | `registryHealth.status: healthy` |

Failures update `lastFailure` while retaining the last proven status. A failed or ambiguous npm command therefore leaves a candidate `verified`; rerunning `release:publish` rechecks remote refs and npm instead of relying on a `pushedAt` timestamp.

---

### Task 1: Align the accepted release contracts

**Files:**
- Modify: `docs/specs/release-verification.md`
- Modify: `docs/specs/v3-dependency-version-strategy.md`
- Include when committing: `docs/superpowers/plans/2026-08-10-release-publication-boundary.md`

**Interfaces:**
- Consumes: the accepted 3.0 exact-artifact and frozen-profile contracts.
- Produces: one unambiguous long-lived contract for the code and maintainer runbook implemented by later tasks.

- [ ] **Step 1: Replace the single-command side-effect model in the release-verification spec**

Make the entrypoint and side-effect boundary state the following exact behavior:

```markdown
`pnpm release:prepare <exact-version>` performs the complete pre-publication
gate and stops after writing `status: verified`. Before that command returns it
must not fast-forward the formal branch, create the final tag, contact a Git
remote, or publish to npm.

The maintainer then fast-forwards `main`, creates the final tag, atomically
pushes both refs, and verifies the remote branch and peeled tag targets. These
ordinary Git operations are an explicit human boundary and are not journal
states inferred by the release program.

`pnpm release:publish <exact-version>` accepts only frozen verified evidence,
revalidates local and remote refs plus the retained artifact, and reconciles
the exact registry version by `dist.integrity` before deciding whether npm
publication is necessary.
```

Remove requirements that the program itself fast-forward, create the final tag, or push. Remove `pushed`/`pushedAt` as publication authorization. State that remote-ref mismatch or absence stops before npm access.

- [ ] **Step 2: Replace the reconciliation section with idempotent publication semantics**

Use these outcomes:

```markdown
1. Exact version absent: publish the retained tarball, then query the exact
   version again before recording `published`.
2. Exact version present with matching `dist.integrity`: record `published`
   without republishing.
3. Exact version present with different `dist.integrity`: stop with a fatal
   artifact conflict.
4. Registry query or publish result indeterminate: retain `verified` evidence
   and retry the same `release:publish` command later.
```

Explicitly state that publication cannot accept a different tarball, rebuild, repack, force-update refs, roll back a remote, or infer success from a command promise.

- [ ] **Step 3: Fix the Registry Smoke profile drift in both accepted specs**

In `docs/specs/release-verification.md`, replace the stale first-smoke `actual-latest`/first-resolution language with:

```markdown
The first Registry Smoke Test and its one permitted retry use the complete
frozen `v3-known-latest` Version Profile stored in the release evidence. They
do not resolve current registry latest versions and do not mutate the frozen
profile.
```

In `docs/specs/v3-dependency-version-strategy.md`, replace references to the old `pnpm release <version>` entrypoint with the prepare/manual-Git/publish boundary. Leave the profile versions and baseline-freeze rules unchanged.

- [ ] **Step 4: Verify the specs no longer express conflicting contracts**

Run:

```bash
rg -n "actual-latest|pushedAt|pnpm release <|atomically pushes|fast-forwards.*main" docs/specs
rg -n "release:prepare|release:publish|frozen.*v3-known-latest|remote.*tag" docs/specs
```

Expected: the first command has no stale normative release-flow/profile matches; the second finds the new contract in both relevant specs.

- [ ] **Step 5: Commit the contract change**

```bash
git add docs/specs/release-verification.md docs/specs/v3-dependency-version-strategy.md docs/superpowers/plans/2026-08-10-release-publication-boundary.md
git commit -m "docs: simplify v3 release publication contract"
```

---

### Task 2: Make preparation a side-effect-free terminal phase

**Files:**
- Modify: `test/releaseGate.test.ts`
- Modify: `scripts/release-verification/release.d.mts`
- Modify: `scripts/release-verification/release.mjs`

**Interfaces:**
- Consumes: `prepareRelease`, fixed profile verification, manual checks, retained `PackageArtifact`.
- Produces: `PrepareReleaseRequest`, `PublishReleaseRequest`, schema-v2 `LeanReleaseEvidence`, `runReleasePreparation()`, and a stable local preparation branch.

- [ ] **Step 1: Write failing CLI and state-model tests**

Replace the old release/reconcile parser assertions with:

```ts
expect(parseReleaseArguments(['prepare', '3.0.0'])).toEqual({
  mode: 'prepare',
  targetVersion: '3.0.0',
  skipManualReason: null,
})
expect(parseReleaseArguments([
  'prepare',
  '3.0.1',
  '--skip-manual',
  'documentation-only release',
])).toEqual({
  mode: 'prepare',
  targetVersion: '3.0.1',
  skipManualReason: 'documentation-only release',
})
expect(parseReleaseArguments(['publish', '3.0.0'])).toEqual({
  mode: 'publish',
  targetVersion: '3.0.0',
})
expect(() => parseReleaseArguments(['reconcile', '3.0.0']))
  .toThrow('Unknown release command')
```

Add a preparation assertion that `runReleasePreparation()` returns `status: 'verified'`, records `preparationBranch: 'release-prep/v3.0.0'`, and never calls remote-state lookup, publication-time registry lookup, or publish. Preserve the existing read-only preflight check that the exact npm version is absent.

- [ ] **Step 2: Run the focused test and confirm the contract is red**

Run:

```bash
pnpm exec vitest run test/releaseGate.test.ts
```

Expected: failures show the old `release`/`reconcile` modes, publication effects after verification, and schema-v1 evidence.

- [ ] **Step 3: Define the schema-v2 request and evidence types**

In `scripts/release-verification/release.d.mts`, replace the old request/status types with:

```ts
export interface PrepareReleaseRequest {
  mode: 'prepare'
  targetVersion: string
  skipManualReason: string | null
}

export interface PublishReleaseRequest {
  mode: 'publish'
  targetVersion: string
}

export interface LeanReleaseEvidence {
  schemaVersion: 2
  status: 'preparing' | 'verified' | 'published'
  changeHeadCommit: string
  preparationBranch: string | null
  sourceChecks: null | {
    command: 'pnpm verify:source'
    passed: boolean
    completedAt: string
  }
  identity: ReleaseIdentity | null
  artifact?: {
    archivePath: string
    filename: string
    sha256: string
    packageName: string
    packageVersion: string
    packlist: string[]
  }
  releaseBaseline: ReleaseBaseline | null
  compatibilityProfiles: CompatibilityMatrixProfileEvidence[]
  manualCheck: null | {
    required: boolean
    reason: string
    results: Record<string, boolean> | null
  }
  timestamps: Record<string, string>
  lastFailure?: {
    stage: string
    message: string
  }
  registryHealth?: RegistryHealthEvidence
}
```

Update exported signatures to `runReleasePreparation()` and `runReleasePublication()`. Keep `runReleaseRegistrySmokeRetry()`. Remove `ReconciliationRequest`, `runReleaseGate()`, and `runReleaseReconciliation()` rather than maintaining aliases for an unreleased internal CLI.

- [ ] **Step 4: Make the preparation branch stable and observable**

Change the preparation effect to use:

```js
const branchName = `release-prep/v${version}`
```

Return it with the prepared commit and artifact:

```js
return {
  sourceCommit,
  preparationBranch: branchName,
  artifact: {
    ...artifact,
    archivePath,
  },
}
```

Delete the process-local `preparedBranches` map. The successful preparation branch remains as the local reachability anchor after the disposable worktree is removed. Failed preparation continues to delete the branch in `finally`.

- [ ] **Step 5: End orchestration immediately after verified evidence**

Rename the old gate function and terminate it after manual verification:

```js
evidence.status = 'verified'
evidence.preparationBranch = prepared.preparationBranch
evidence.timestamps.verifiedAt = effects.now()
delete evidence.lastFailure
await effects.writeEvidence(evidence)
return evidence
```

Remove automatic `fastForward`, `createTag`, `push`, `pushedAt`, npm publish, and initial Registry Smoke from the preparation path. Preparation failures retain `status: 'preparing'` and write `lastFailure`; they must not invent a `blocked` fact.

- [ ] **Step 6: Make schema-v1 evidence fail closed**

When reading evidence for publish or registry-smoke retry, require `schemaVersion === 2` and emit a message that release-code changes invalidate prior evidence. Do not add a converter.

- [ ] **Step 7: Run the focused tests**

Run:

```bash
pnpm exec vitest run test/releaseGate.test.ts test/registrySmoke.test.ts
```

Expected: preparation tests pass; publication tests that still expect `pushed` or reconciliation remain red until Task 4.

---

### Task 3: Verify remote Git identity without owning Git publication

**Files:**
- Modify: `test/releaseGate.test.ts`
- Modify: `scripts/release-verification/release.d.mts`
- Modify: `scripts/release-verification/release.mjs`

**Interfaces:**
- Consumes: `ReleaseIdentity.sourceCommit`, formal branch `main`, tag `v<targetVersion>`, Git remote `origin`.
- Produces: `RemoteReleaseState` and `ReleaseEffects.readRemoteReleaseState()` for publication authorization.

- [ ] **Step 1: Write failing remote-ref tests**

Add orchestration cases proving:

```ts
it.each([
  [{ branchCommit: null, tagCommit: null }, 'remote main'],
  [{ branchCommit: 'different', tagCommit: 'prepared-release-commit' }, 'remote main'],
  [{ branchCommit: 'prepared-release-commit', tagCommit: null }, 'remote tag'],
  [{ branchCommit: 'prepared-release-commit', tagCommit: 'different' }, 'remote tag'],
])('stops before npm when remote identity is invalid', async (remote, message) => {
  const effects = createInertEffects()
  effects.readEvidence.mockResolvedValueOnce(structuredClone(verifiedEvidence))
  effects.readRemoteReleaseState.mockResolvedValueOnce(remote)

  await expect(runReleasePublication({
    request: publishRequest,
    repositoryRoot: '/repo',
    effects: effects as never,
  })).rejects.toThrow(message)

  expect(effects.readRegistryRelease).not.toHaveBeenCalled()
  expect(effects.publish).not.toHaveBeenCalled()
})
```

Add a production-effect test with an annotated tag response containing both `refs/tags/v3.0.0` and `refs/tags/v3.0.0^{}`; require the peeled commit to be returned.

- [ ] **Step 2: Run the focused test and confirm it fails before npm lookup**

Run:

```bash
pnpm exec vitest run test/releaseGate.test.ts
```

Expected: `readRemoteReleaseState` and `runReleasePublication` do not yet exist.

- [ ] **Step 3: Add the explicit remote-state seam**

Add:

```ts
export interface RemoteReleaseState {
  branchCommit: string | null
  tagCommit: string | null
}

readRemoteReleaseState: (input: {
  branch: 'main'
  repositoryRoot: string
  tagName: string
}) => Promise<RemoteReleaseState>
```

The production effect must run exactly one read-only command:

```js
const result = await commandRunner({
  command: 'git',
  args: [
    'ls-remote',
    'origin',
    `refs/heads/${branch}`,
    `refs/tags/${tagName}`,
    `refs/tags/${tagName}^{}`,
  ],
  cwd: repositoryRoot,
})
```

Parse lines into a ref-to-object map. Return the branch object and `peeledTag ?? directTag ?? null`, so annotated and lightweight tags can be checked while the runbook standardizes on annotated tags.

- [ ] **Step 4: Narrow local identity validation to the publish boundary**

Keep the existing checks for clean formal `main`, local HEAD, local tag target, formal/artifact manifests, release baseline, archive path, SHA-256, and npm SHA-512. Replace the phase union with only the phases still used by code, such as `'publish' | 'registry-smoke'`.

Before any npm registry query, require:

```js
if (remote.branchCommit !== evidence.identity.sourceCommit) {
  throw new Error('remote main does not resolve to the verified release commit')
}
if (remote.tagCommit !== evidence.identity.sourceCommit) {
  throw new Error('remote tag does not resolve to the verified release commit')
}
```

Record the failure as `lastFailure.stage: 'remote-identity'` while retaining `status: 'verified'`.

- [ ] **Step 5: Run the remote identity tests**

Run:

```bash
pnpm exec vitest run test/releaseGate.test.ts -t "remote|identity"
```

Expected: annotated tag peeling passes, every missing/mismatched ref stops before registry lookup, and no Git mutation command appears in production effects.

---

### Task 4: Make exact-tarball publication idempotent

**Files:**
- Modify: `test/releaseGate.test.ts`
- Modify: `test/registrySmoke.test.ts`
- Modify: `scripts/release-verification/release.d.mts`
- Modify: `scripts/release-verification/release.mjs`
- Modify: `scripts/release-verification/registry-smoke.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: schema-v2 `verified` evidence, valid local/remote Git identity, retained artifact, `readRegistryRelease()`.
- Produces: idempotent `runReleasePublication()`, `published` evidence only after matching registry integrity, and the existing frozen-profile Registry Smoke lifecycle.

- [ ] **Step 1: Replace reconciliation tests with publication truth-table tests**

Use `verifiedEvidence` and cover all of these cases:

```ts
it('publishes the retained tarball only when the version is absent', async () => {})
it('accepts an existing version only when integrity matches', async () => {})
it('accepts an ambiguous publish when the follow-up registry integrity matches', async () => {})
it('retains verified evidence when publish and follow-up lookup stay indeterminate', async () => {})
it('rejects different registry integrity without publishing', async () => {})
it('does not publish when the initial registry query fails', async () => {})
it('treats published evidence with registry health as a no-op', async () => {})
```

For every success, assert the exact archive path and `distTag: 'latest'`. For every uncertain result, assert `status: 'verified'` and a `lastFailure` stage; never assert `pushedAt`.

- [ ] **Step 2: Run the truth-table tests and confirm they fail**

Run:

```bash
pnpm exec vitest run test/releaseGate.test.ts -t "publication|registry"
```

Expected: old reconciliation guards and `pushed` evidence conflict with the new cases.

- [ ] **Step 3: Implement one registry-integrity decision helper**

Centralize the comparison so initial lookup and post-publish reconciliation cannot drift:

```js
function assertMatchingRegistryIntegrity(registryRelease, expectedIntegrity) {
  if (registryRelease.state !== 'published') return false
  if (registryRelease.integrity !== expectedIntegrity) {
    throw new Error('Registry version has a different artifact integrity')
  }
  return true
}
```

Do not treat thrown/undefined registry results as absence.

- [ ] **Step 4: Implement the idempotent publication sequence**

The ordered behavior in `runReleasePublication()` must be:

```js
const evidence = await effects.readEvidence({ repositoryRoot, targetVersion })
assertPublishableEvidence(evidence, targetVersion)

if (evidence.status === 'published' && evidence.registryHealth) return evidence

await assertLocalAndRemotePublicationIdentity({ evidence, effects, repositoryRoot })
const before = await effects.readRegistryRelease({ packageName, targetVersion })

if (!assertMatchingRegistryIntegrity(before, expectedIntegrity)) {
  let publishError = null
  try {
    await effects.publish({ archivePath: evidence.artifact.archivePath, distTag: 'latest' })
  }
  catch (error) {
    publishError = error
  }

  const after = await effects.readRegistryRelease({ packageName, targetVersion })
  if (!assertMatchingRegistryIntegrity(after, expectedIntegrity)) {
    await recordLastFailure(evidence, publishError ?? new Error('publication is not visible'))
    throw new Error('Publication remains indeterminate')
  }
}

evidence.status = 'published'
evidence.timestamps.publishedAt = effects.now()
delete evidence.lastFailure
await effects.writeEvidence(evidence)
await recordRegistryHealth({ effects, evidence })
return evidence
```

Wrap the initial and follow-up registry queries so failures preserve the last proven status. A registry integrity conflict is fatal. An absent follow-up or lookup error is indeterminate and retryable with the same command.

Use one wrapper for both registry reads so error journaling is not duplicated:

```js
async function readRegistryReleaseOrRecordFailure({
  effects,
  evidence,
  input,
  stage,
}) {
  try {
    return await effects.readRegistryRelease(input)
  }
  catch (error) {
    await recordLastFailure({ effects, evidence, error, stage })
    throw new Error(`Registry lookup failed during ${stage}`, { cause: error })
  }
}
```

- [ ] **Step 5: Remove obsolete Git-publication and reconciliation effects**

Delete `fastForward`, `createTag`, `push`, `runReleaseReconciliation`, their type declarations, and their production tests. Keep the negative API assertions that there is no rollback, force push, tag replacement, unpublish, deprecate, or repack capability.

- [ ] **Step 6: Expose explicit package scripts**

Replace the old `release` script with:

```json
{
  "release:prepare": "node scripts/release-verification/release.mjs prepare",
  "release:publish": "node scripts/release-verification/release.mjs publish",
  "release:registry-smoke": "node scripts/release-verification/release.mjs registry-smoke"
}
```

Update generated `registryHealth.retryCommand` values to `pnpm release:registry-smoke <version>`.

- [ ] **Step 7: Run focused release and registry-smoke tests**

Run:

```bash
pnpm exec vitest run test/releaseGate.test.ts test/registrySmoke.test.ts
pnpm test:types
```

Expected: all release truth-table, production-effect, schema-v2, frozen-profile, and type tests pass.

- [ ] **Step 8: Commit the release implementation**

```bash
git add package.json scripts/release-verification/release.mjs scripts/release-verification/release.d.mts scripts/release-verification/registry-smoke.mjs test/releaseGate.test.ts test/registrySmoke.test.ts
git commit -m "fix(release): separate Git publication from npm publish"
```

---

### Task 5: Rewrite the maintainer handoff and recovery runbook

**Files:**
- Modify: `docs/en/RELEASING.md`
- Modify: `AGENTS.md`
- Test: `test/releaseGate.test.ts`

**Interfaces:**
- Consumes: `release:prepare`, schema-v2 evidence, stable `release-prep/v<version>` branch, `release:publish`, `release:registry-smoke`.
- Produces: the only supported human Git procedure and narrow recovery rules.

- [ ] **Step 1: Add repository-integration assertions for the documented scripts**

Update the existing package/runbook integration test to assert:

```ts
expect(manifest.scripts['release:prepare'])
  .toBe('node scripts/release-verification/release.mjs prepare')
expect(manifest.scripts['release:publish'])
  .toBe('node scripts/release-verification/release.mjs publish')
expect(manifest.scripts['release:registry-smoke'])
  .toBe('node scripts/release-verification/release.mjs registry-smoke')
expect(manifest.scripts).not.toHaveProperty('release')
expect(releasing).toContain('git push --atomic origin main v3.0.0')
expect(releasing).toContain("refs/tags/v3.0.0^{}")
```

- [ ] **Step 2: Run the integration assertion and confirm the old runbook fails it**

Run:

```bash
pnpm exec vitest run test/releaseGate.test.ts -t "repository integration"
```

Expected: package scripts and maintainer commands still use the old single-command flow.

- [ ] **Step 3: Document the standard preparation and Git handoff**

Make `docs/en/RELEASING.md` present this sequence:

```bash
pnpm release:prepare 3.0.0
git merge --ff-only <sourceCommit>
git tag -a v3.0.0 <sourceCommit> -m "v3.0.0"
git push --atomic origin main v3.0.0
git ls-remote origin refs/heads/main refs/tags/v3.0.0 'refs/tags/v3.0.0^{}'
pnpm release:publish 3.0.0
git branch -d release-prep/v3.0.0
```

Explain that `<sourceCommit>`, `preparationBranch`, and tarball SHA-512 come from `.release-evidence/3.0.0/release.json`. The maintainer must visually compare remote `main` and the peeled tag with `sourceCommit` before publication; `release:publish` independently enforces the same comparison.

- [ ] **Step 4: Document narrow, ordinary-Git recovery**

State these exact cases:

- If prepare fails, the program cleans the disposable worktree/branch; move or remove the invalid evidence directory only after inspection, then rerun prepare.
- If local `main` fast-forwarded but push has not succeeded, do not rerun prepare. Correct the local tag if needed and continue from the frozen evidence.
- If push returns an error or loses its response, run `git ls-remote`. If both remote refs resolve to `sourceCommit`, proceed to publish. If neither exists, rerun the atomic push. If only one matches or either points elsewhere, stop for manual Git diagnosis; never force-update through the release program.
- If npm publication or its response is ambiguous, rerun `pnpm release:publish 3.0.0`; it queries exact-version integrity before deciding whether to publish.
- If Registry Smoke fails after publication, use only `pnpm release:registry-smoke 3.0.0` with the frozen profile.

Remove the old claim that every pre-push failure can start a fresh release and remove the `reconcile` command.

- [ ] **Step 5: Update repository agent guidance**

Change `AGENTS.md` to say:

```markdown
Before release, use `pnpm verify:source`; prepare an exact version with
`pnpm release:prepare <version>`, perform the documented Git handoff, and
publish only through `pnpm release:publish <version>`. Follow
`docs/en/RELEASING.md` for recovery.
```

- [ ] **Step 6: Check all tracked command references**

Run:

```bash
rg -n "pnpm release( |$)|release reconcile|actual-latest|pushedAt" . --glob '!node_modules/**' --glob '!pnpm-lock.yaml'
rg -n "release:prepare|release:publish|release:registry-smoke" AGENTS.md package.json docs scripts test
```

Expected: no obsolete maintainer command, reconciliation command, stale Registry Smoke profile, or `pushedAt` state remains; all new commands point to one implementation.

- [ ] **Step 7: Commit the runbook**

```bash
git add AGENTS.md docs/en/RELEASING.md test/releaseGate.test.ts
git commit -m "docs: document the manual Git release handoff"
```

---

### Task 6: Prove source and package-artifact integrity without releasing

**Files:**
- Inspect only: repository status, test output, generated untracked/ignored artifacts.
- Do not create: `.release-evidence/<real-version>/`, Git tags, remote refs, or npm versions.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: evidence that the maintenance simplification did not weaken source, type, Minimum, or Known-Latest package-artifact contracts.

- [ ] **Step 1: Run formatting and static checks**

```bash
pnpm lint --fix
pnpm test:types
```

Expected: both commands exit 0.

- [ ] **Step 2: Run the complete test suite**

```bash
pnpm test
```

Expected: all Vitest files pass, including the remote-ref and idempotent-publication truth table.

- [ ] **Step 3: Run the Nuxt 4.1 minimum package-artifact profile**

```bash
pnpm test:compatibility-profile -- --profile v3-minimum
```

Expected: clean installation, public package types, production build, and basic browser SVG rendering pass with the frozen Minimum profile.

- [ ] **Step 4: Run the frozen known-latest package-artifact profile**

```bash
pnpm test:package-artifact
```

Expected: clean installation, public package types, production build, and basic browser SVG rendering pass with `v3-known-latest`.

- [ ] **Step 5: Inspect scope and confirm no release side effect occurred**

```bash
git status --short
git diff --check
git log -6 --oneline --decorate
git tag --list 'v3.0.0'
test ! -d .release-evidence && echo "no release evidence created"
```

Expected: only intentional plan/implementation/doc changes exist, no `v3.0.0` tag exists, and no release evidence was created. Do not run `git push`, `npm publish`, `pnpm release:prepare 3.0.0`, or `pnpm release:publish 3.0.0` as verification.

- [ ] **Step 6: Commit any lint-only corrections with the owning implementation commit**

If `pnpm lint --fix` changed task-owned files, amend or add them to the relevant implementation/runbook commit. Do not mix unrelated user changes into these commits.

## Completion Criteria

- `release:prepare` reaches `verified` and has no code path that changes formal `main`, creates the final tag, contacts a Git remote, or mutates npm; its existing read-only exact-version absence preflight remains.
- A stable local preparation branch keeps `sourceCommit` reachable and is documented for cleanup.
- `release:publish` refuses npm access unless local `main`/tag and remote `main`/peeled-tag all match `sourceCommit` and the retained artifact identity still matches.
- A lost push response has a read-only `git ls-remote` recovery path; no `pushedAt` inference exists.
- Local main/tag mutations do not force a fresh release attempt; the verified evidence remains usable by the separate publish command.
- npm publication is retryable by rerunning the same command and is accepted only by matching `dist.integrity`.
- Both initial and retry Registry Smoke use frozen `v3-known-latest` evidence.
- Source checks and both package-artifact profiles pass.
- No 3.0 tag, push, PR, npm publication, or real release evidence is created during implementation.
