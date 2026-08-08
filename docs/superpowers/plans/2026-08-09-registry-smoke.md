# Registry Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the exact npm registry version after publication through the existing clean consumer, retain a frozen dependency profile for evidence-owned retry, and document manual unhealthy-release recovery.

**Architecture:** Extend the existing consumer operation with two explicit package-source variants, then keep one private runner core behind fixed artifact and registry verification plans. A focused registry-smoke policy module owns additive health evidence and retry classification, while the existing release entrypoint invokes it after publication and dispatches an evidence-owned retry command.

**Tech Stack:** Node.js ESM, TypeScript declaration files, Vitest 4, Nuxt test utilities, npm registry installation, pnpm scripts.

## Global Constraints

- Registry input is one exact SemVer package version; workspace, tarball, source, file URL, range, and dist-tag fallback are invalid.
- Reuse `test/release-verification/consumer-template`, the existing consumer operations, runner, browser smoke, and Nuxt 4 actual-latest Version Profile.
- The artifact plan remains fixed to its existing full flow; the registry plan is fixed to `install -> build -> runtime`; callers cannot supply stages.
- The first attempt resolves the actual-latest profile once; retry loads the frozen profile from release evidence and exposes no profile override.
- Keep the existing top-level publication `status`; add optional `registryHealth` so evidence written before this change remains readable.
- A first failure is `investigation`; only an independently clean retry matching exact version, frozen profile, `package-defect` classification, and package-user stage is `unhealthy`.
- Registry smoke and tests never publish, deprecate, promote, patch, unpublish, roll back, or contact a persistence service.
- Recovery remains manual: investigate, retry cleanly, deprecate only a confirmed unhealthy exact version, verify a corrective patch, and never unpublish.

## File Map

- Modify `scripts/release-verification/operations.mjs`: create clean-consumer manifests from an artifact or an exact registry version and return both resolved package and dependency versions.
- Modify `scripts/release-verification/runner.mjs`: retain a private consumer core and add a fixed registry verification orchestrator.
- Modify `scripts/release-verification/runner.d.mts`: declare package-source, install-result, registry request/evidence, and registry failure interfaces.
- Create `scripts/release-verification/registry-smoke.mjs`: own initial health evidence, failure classification, evidence validation, and retry transitions.
- Create `scripts/release-verification/registry-smoke.d.mts`: declare the additive health/attempt model and orchestration interfaces.
- Modify `scripts/release-verification/failure-classification.mjs` and `.d.mts`: distinguish registry, network, runner, permission, and package-defect failures.
- Modify `scripts/release-verification/release.mjs` and `.d.mts`: invoke smoke after publish/reconciliation, preserve publication state, and dispatch exact-version retry.
- Modify `test/releaseVerificationOperations.test.ts`: cover registry-only manifest construction and resolved-version mismatch.
- Modify `test/releaseVerificationRunner.test.ts`: cover the fixed registry plan and shared consumer core behavior.
- Create `test/registrySmoke.test.ts`: cover health transitions, frozen profile loading, retry validation, and classification matching.
- Modify `test/releaseGate.test.ts`: cover post-publication integration, additive evidence compatibility, reconciliation, and CLI retry dispatch.
- Modify `docs/en/RELEASING.md`: add the one-page investigation/deprecation/corrective-patch runbook.

---

### Task 1: Add an exact registry source to the clean-consumer operation

**Files:**
- Modify: `scripts/release-verification/operations.mjs:308-388`
- Modify: `scripts/release-verification/runner.d.mts:13-134`
- Test: `test/releaseVerificationOperations.test.ts:108-258`

**Interfaces:**
- Consumes: existing `PackageArtifact`, `VersionProfile`, consumer template, and `installedPackageVersion()` guard.
- Produces: `ConsumerPackageSource` and `ConsumerInstallResult`; `installConsumer({ packageSource, consumerDirectory, profile })` becomes the single operation used by both fixed runner plans.

- [ ] **Step 1: Write a failing registry-install test**

Add a test whose command double populates real package manifests under the temporary consumer and whose independent assertions inspect the generated manifest:

```ts
it('installs only the exact registry version and reports the resolved identity', async () => {
  const templateDirectory = await createTemplate()
  const consumerDirectory = await createTemporaryDirectory('registry-consumer')
  const commandRunner = vi.fn(async () => {
    await populateInstalledPackages(consumerDirectory, '3.0.0')
    return {}
  })
  const operations = createReleaseVerificationOperations({
    templateDirectory,
    commandRunner,
  })

  const result = await operations.installConsumer({
    packageSource: {
      kind: 'registry',
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '3.0.0',
    },
    consumerDirectory,
    profile,
  })

  const manifest = JSON.parse(await readFile(join(consumerDirectory, 'package.json'), 'utf8'))
  expect(manifest.dependencies['@barzhsieh/nuxt-content-mermaid']).toBe('3.0.0')
  expect(JSON.stringify(manifest)).not.toContain('workspace:')
  expect(JSON.stringify(manifest)).not.toContain('file:')
  expect(result).toEqual({
    packageVersion: '3.0.0',
    profileVersions: profile.versions,
  })
  expect(commandRunner).toHaveBeenCalledWith({
    command: 'npm',
    args: ['install', '--no-audit', '--no-fund', '--package-lock=true'],
    cwd: consumerDirectory,
  })
})
```

Change `populateInstalledPackages` to accept the package version as an optional second argument defaulting to `2.2.3`; this keeps existing expectations literal.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test -- test/releaseVerificationOperations.test.ts -t "installs only the exact registry version"`

Expected: FAIL because `installConsumer` still requires `artifact` and returns only the resolved profile.

- [ ] **Step 3: Define the source and install-result contracts**

Add these declarations to `runner.d.mts` and update `ReleaseVerificationOperations.installConsumer`:

```ts
export type ConsumerPackageSource
  = | { kind: 'artifact', artifact: PackageArtifact }
    | {
      kind: 'registry'
      packageName: string
      packageVersion: string
    }

export interface ConsumerInstallResult {
  packageVersion: string
  profileVersions: VersionProfile['versions']
}

installConsumer: (input: {
  packageSource: ConsumerPackageSource
  consumerDirectory: string
  profile: VersionProfile
}) => Promise<ConsumerInstallResult>
```

- [ ] **Step 4: Implement exact source selection and the resolved-version guard**

Keep source selection private to `operations.mjs`. The registry branch must reject non-exact SemVer before copying the template or invoking npm:

```js
const EXACT_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9a-z-]+(?:\.[0-9a-z-]+)*))?(?:\+([0-9a-z-]+(?:\.[0-9a-z-]+)*))?$/i

function assertExactRegistryVersion(version) {
  const match = typeof version === 'string'
    ? EXACT_SEMVER_PATTERN.exec(version)
    : null
  const prerelease = match?.[4]?.split('.') ?? []
  if (!match || prerelease.some(identifier => /^\d+$/.test(identifier) && /^0\d+/.test(identifier))) {
    throw new Error('Registry smoke requires an exact package version')
  }
}

function packageDependency(packageSource) {
  if (packageSource?.kind === 'artifact') {
    return {
      name: packageSource.artifact.packageName,
      version: packageSource.artifact.packageVersion,
      dependency: pathToFileURL(packageSource.artifact.archivePath).href,
    }
  }
  if (packageSource?.kind === 'registry') {
    assertExactRegistryVersion(packageSource.packageVersion)
    return {
      name: packageSource.packageName,
      version: packageSource.packageVersion,
      dependency: packageSource.packageVersion,
    }
  }
  throw new Error(`Unsupported consumer package source: ${packageSource?.kind}`)
}
```

Generate the package manifest using `source.name` and `source.dependency`, call `installedPackageVersion(consumerDirectory, source.name, source.version)`, and return:

```js
return {
  packageVersion: resolvedPackageVersion,
  profileVersions: {
    betterSqlite3: resolvedBetterSqlite3,
    nuxt: resolvedNuxt,
    nuxtContent: resolvedNuxtContent,
    mermaid: resolvedMermaid,
    typescript: resolvedTypescript,
    vueTsc: resolvedVueTsc,
  },
}
```

- [ ] **Step 5: Add the mismatch and fallback rejection cases**

Add table-driven assertions for `latest`, `^3.0.0`, `workspace:*`, `file:../package.tgz`, and `/tmp/package.tgz`; each must reject before `commandRunner` is called. Add a separate command double that installs `3.0.1` for a `3.0.0` request and assert:

```ts
await expect(operations.installConsumer({
  packageSource: {
    kind: 'registry',
    packageName: '@barzhsieh/nuxt-content-mermaid',
    packageVersion: '3.0.0',
  },
  consumerDirectory,
  profile,
})).rejects.toThrow('expected 3.0.0, received 3.0.1')
```

- [ ] **Step 6: Convert existing artifact callers without changing behavior**

Replace every artifact operation call with:

```ts
packageSource: { kind: 'artifact', artifact }
```

Update expectations in `test/releaseVerificationOperations.test.ts`, `test/releaseVerificationRunner.test.ts`, `test/releaseGate.test.ts`, `scripts/release-verification/runner.mjs`, and the manual consumer path in `release.mjs`. Existing artifact evidence and stage order must remain unchanged.

- [ ] **Step 7: Run the focused operation suite and typecheck**

Run: `pnpm test -- test/releaseVerificationOperations.test.ts`

Expected: PASS.

Run: `pnpm test:types`

Expected: PASS.

- [ ] **Step 8: Commit the operation boundary**

```bash
git add scripts/release-verification/operations.mjs scripts/release-verification/runner.d.mts test/releaseVerificationOperations.test.ts test/releaseVerificationRunner.test.ts test/releaseGate.test.ts scripts/release-verification/runner.mjs scripts/release-verification/release.mjs
git commit -m "feat: install exact registry package in clean consumer"
```

---

### Task 2: Add a fixed registry verification plan behind the private runner core

**Files:**
- Modify: `scripts/release-verification/runner.mjs:1-383`
- Modify: `scripts/release-verification/runner.d.mts:30-164`
- Test: `test/releaseVerificationRunner.test.ts`

**Interfaces:**
- Consumes: `ConsumerPackageSource`, `ConsumerInstallResult`, `VersionProfile`, and `ReleaseVerificationOperations` from Task 1.
- Produces: `runRegistrySmokeVerification(request, operations)`, `RegistrySmokeVerificationRequest`, `RegistrySmokeVerificationEvidence`, and `RegistrySmokeVerificationFailure`.

- [ ] **Step 1: Write a failing fixed-plan test**

```ts
it('runs the fixed registry plan in one clean consumer', async () => {
  const { operations, workspace } = createOperations()

  const evidence = await runRegistrySmokeVerification({
    packageName: '@barzhsieh/nuxt-content-mermaid',
    packageVersion: '3.0.0',
    profile: knownLatestProfile,
  }, operations)

  expect(operations.createArtifact).not.toHaveBeenCalled()
  expect(operations.inspectArchive).not.toHaveBeenCalled()
  expect(operations.verifyPackageExports).not.toHaveBeenCalled()
  expect(operations.verifyTypes).not.toHaveBeenCalled()
  expect(operations.installConsumer).toHaveBeenCalledWith({
    packageSource: {
      kind: 'registry',
      packageName: '@barzhsieh/nuxt-content-mermaid',
      packageVersion: '3.0.0',
    },
    consumerDirectory: workspace.consumerDirectory,
    profile: knownLatestProfile,
  })
  expect(evidence.stages.map(stage => [stage.name, stage.status])).toEqual([
    ['install', 'passed'],
    ['build', 'passed'],
    ['runtime', 'passed'],
    ['cleanup', 'passed'],
  ])
})
```

- [ ] **Step 2: Run the runner test and verify RED**

Run: `pnpm test -- test/releaseVerificationRunner.test.ts -t "runs the fixed registry plan"`

Expected: FAIL because `runRegistrySmokeVerification` is not exported.

- [ ] **Step 3: Add exact registry request and evidence declarations**

```ts
export interface RegistrySmokeVerificationRequest {
  packageName: string
  packageVersion: string
  profile: VersionProfile
}

export interface RegistrySmokeVerificationEvidence {
  schemaVersion: 1
  success: boolean
  mode: 'registry-smoke'
  package: {
    name: string
    requestedVersion: string
    resolvedVersion: string | null
  }
  profile: {
    id: string
    requested: VersionProfile['versions']
    resolved: VersionProfile['versions'] | null
  }
  stages: VerificationStageEvidence[]
}
```

Declare `RegistrySmokeVerificationFailure` with `stage`, `cause`, and `evidence`, mirroring the artifact failure without widening `ReleaseVerificationFailure.evidence`.

- [ ] **Step 4: Refactor one private core around fixed named plans**

Keep the plans private and immutable:

```js
const CONSUMER_VERIFICATION_PLANS = Object.freeze({
  artifact: Object.freeze(['install', 'exports', 'types', 'build', 'runtime']),
  registry: Object.freeze(['install', 'build', 'runtime']),
})
```

The private core accepts `plan: 'artifact' | 'registry'`; no exported function accepts a stage list. It always creates or receives one clean workspace, records `installConsumer()`'s `packageVersion` and `profileVersions`, executes only the named plan, marks only that plan's remaining stages skipped, and cleans the workspace.

- [ ] **Step 5: Implement the public registry orchestrator**

Validate the exact package version before `createWorkspace()`, create registry-mode evidence, and call the private core with `plan: 'registry'` and:

```js
packageSource: {
  kind: 'registry',
  packageName: request.packageName,
  packageVersion: request.packageVersion,
}
```

On success set `evidence.success = true`; on failure throw `RegistrySmokeVerificationFailure` with stage evidence retained.

- [ ] **Step 6: Add mutation-sensitive failure cases**

Add tests proving:

- `latest`, a range, workspace protocol, and file path are rejected before workspace creation;
- install failure skips only `build` and `runtime`;
- build failure skips only `runtime`;
- runtime failure is reported as `runtime`;
- cleanup failure remains a required failure;
- artifact tests still include `exports` and `types`.

Use literal stage arrays in every assertion; do not derive expectations from the runner constants.

- [ ] **Step 7: Run focused runner and operation suites**

Run: `pnpm test -- test/releaseVerificationRunner.test.ts test/releaseVerificationOperations.test.ts`

Expected: PASS.

Run: `pnpm test:types`

Expected: PASS.

- [ ] **Step 8: Commit the fixed registry plan**

```bash
git add scripts/release-verification/runner.mjs scripts/release-verification/runner.d.mts test/releaseVerificationRunner.test.ts
git commit -m "feat: add fixed registry smoke verification plan"
```

---

### Task 3: Model initial registry health and failure categories

**Files:**
- Create: `scripts/release-verification/registry-smoke.mjs`
- Create: `scripts/release-verification/registry-smoke.d.mts`
- Modify: `scripts/release-verification/failure-classification.mjs`
- Modify: `scripts/release-verification/failure-classification.d.mts`
- Create: `test/registrySmoke.test.ts`

**Interfaces:**
- Consumes: `runRegistrySmokeVerification`, `RegistrySmokeVerificationFailure`, `VersionProfile`, and existing nested error causes.
- Produces: `createPendingRegistryHealth(input)`, `runInitialRegistrySmoke(input)`, `RegistryHealthEvidence`, `RegistrySmokeAttempt`, and `classifyRegistrySmokeFailure(error)`.

- [ ] **Step 1: Write failing classification tests**

Use independently constructed errors to lock the five categories:

```ts
it.each([
  [Object.assign(new Error('npm registry unavailable'), { code: 'E503' }), 'registry'],
  [Object.assign(new Error('network unreachable'), { code: 'ENETUNREACH' }), 'network'],
  [Object.assign(new Error('spawn browser ENOENT'), { code: 'ENOENT' }), 'runner'],
  [Object.assign(new Error('permission denied'), { code: 'EACCES' }), 'permission'],
  [new ReleaseVerificationPackageUserError('SVG is empty'), 'package-defect'],
])('classifies %s as %s', (error, expected) => {
  expect(classifyRegistrySmokeFailure(error)).toBe(expected)
})
```

- [ ] **Step 2: Run the classification test and verify RED**

Run: `pnpm test -- test/registrySmoke.test.ts -t "classifies"`

Expected: FAIL because the registry-smoke policy and classifier do not exist.

- [ ] **Step 3: Implement the narrow classification API**

Declare and return exactly:

```ts
export type RegistrySmokeFailureClassification
  = | 'registry'
    | 'network'
    | 'runner'
    | 'permission'
    | 'package-defect'
```

Walk nested `cause` values without revisiting objects. Check permission codes `EACCES` and `EPERM`; network codes already recognized by the existing module; runner failures include missing executable/browser diagnostics; npm registry HTTP/code diagnostics map to `registry`; `isPackageUserFailure(error)` maps to `package-defect`. Unknown external failures map to `runner`, never to `package-defect`.

- [ ] **Step 4: Write failing initial-attempt transition tests**

Create literal requested and frozen profiles. Assert success returns `healthy`, while either infrastructure or package-user failure returns `investigation` and a retry command without throwing:

```ts
const registryHealth = createPendingRegistryHealth({
  packageName: '@barzhsieh/nuxt-content-mermaid',
  packageVersion: '3.0.0',
  requestedProfile: {
    nuxt: '>=4.1.0 <5.0.0',
    nuxtContent: '>=3.5.0 <4.0.0',
  },
  profile: actualLatestProfile,
})

expect(await runInitialRegistrySmoke({
  registryHealth,
  verifyRegistryPackage,
  now: () => '2026-08-09T01:00:00.000Z',
})).toMatchObject({
  status: 'investigation',
  package: {
    name: '@barzhsieh/nuxt-content-mermaid',
    version: '3.0.0',
  },
  profile: {
    id: 'nuxt-4-actual-latest-release',
    requested: {
      nuxt: '>=4.1.0 <5.0.0',
      nuxtContent: '>=3.5.0 <4.0.0',
    },
    resolved: actualLatestProfile.versions,
  },
  retryCommand: 'pnpm release registry-smoke 3.0.0',
})
```

- [ ] **Step 5: Define additive health evidence**

```ts
export interface RegistrySmokeAttempt {
  number: number
  completedAt: string
  cleanConsumer: true
  success: boolean
  stage: VerificationStageName | null
  classification: RegistrySmokeFailureClassification | null
  verification: RegistrySmokeVerificationEvidence
}

export interface RegistryHealthEvidence {
  status: 'pending' | 'healthy' | 'investigation' | 'unhealthy'
  package: { name: string, version: string }
  profile: {
    id: string
    requested: Record<string, string>
    resolved: VersionProfile['versions']
  }
  attempts: RegistrySmokeAttempt[]
  retryCommand: string | null
}
```

- [ ] **Step 6: Implement pending evidence and the first-attempt policy**

`createPendingRegistryHealth` validates and freezes package identity, requested ranges, and the exact profile, then returns `pending` evidence with no attempts. `runInitialRegistrySmoke` accepts only that pending object and invokes the injected `verifyRegistryPackage(request)` callback derived from it. A successful runner result appends attempt 1, sets `healthy`, and clears `retryCommand`. A failure with `RegistrySmokeVerificationFailure` appends its complete verification evidence, records the classifier and stage, sets `investigation`, and emits the exact retry command. Propagate programming/validation errors that occur before verification evidence exists.

- [ ] **Step 7: Run the registry policy tests and typecheck**

Run: `pnpm test -- test/registrySmoke.test.ts`

Expected: PASS for classification and initial transitions.

Run: `pnpm test:types`

Expected: PASS.

- [ ] **Step 8: Commit initial health policy**

```bash
git add scripts/release-verification/registry-smoke.mjs scripts/release-verification/registry-smoke.d.mts scripts/release-verification/failure-classification.mjs scripts/release-verification/failure-classification.d.mts test/registrySmoke.test.ts
git commit -m "feat: record registry smoke health evidence"
```

---

### Task 4: Make retry load and validate its frozen profile from evidence

**Files:**
- Modify: `scripts/release-verification/registry-smoke.mjs`
- Modify: `scripts/release-verification/registry-smoke.d.mts`
- Modify: `test/registrySmoke.test.ts`

**Interfaces:**
- Consumes: `RegistryHealthEvidence`, `VersionProfile`, release evidence reader/writer callbacks, and an injected `verifyRegistryPackage(request)` callback backed by Task 2.
- Produces: `runRegistrySmokeRetry({ repositoryRoot, targetVersion, readEvidence, writeEvidence, verifyRegistryPackage, now })`; no profile parameter exists.

- [ ] **Step 1: Write a failing evidence-owned retry test**

```ts
it('loads the frozen profile from the first investigation attempt', async () => {
  const releaseEvidence = createPublishedInvestigationEvidence()
  const readEvidence = vi.fn(async () => structuredClone(releaseEvidence))
  const writeEvidence = vi.fn(async () => undefined)
  const verifyRegistryPackage = vi.fn(async () => successfulVerification)

  await runRegistrySmokeRetry({
    repositoryRoot: '/repo',
    targetVersion: '3.0.0',
    readEvidence,
    writeEvidence,
    verifyRegistryPackage,
    now: () => '2026-08-09T02:00:00.000Z',
  })

  expect(readEvidence).toHaveBeenCalledWith({
    repositoryRoot: '/repo',
    targetVersion: '3.0.0',
  })
  expect(verifyRegistryPackage).toHaveBeenCalledWith({
    packageName: '@barzhsieh/nuxt-content-mermaid',
    packageVersion: '3.0.0',
    profile: actualLatestProfile,
  })
})
```

The function call intentionally has no caller-provided profile.

- [ ] **Step 2: Run the retry test and verify RED**

Run: `pnpm test -- test/registrySmoke.test.ts -t "loads the frozen profile"`

Expected: FAIL because `runRegistrySmokeRetry` is not exported.

- [ ] **Step 3: Implement strict retry evidence validation**

Before creating a consumer, require all of the following literal invariants:

```js
evidence.status === 'published'
evidence.identity.targetVersion === targetVersion
evidence.artifact.packageVersion === targetVersion
evidence.registryHealth.status === 'investigation'
evidence.registryHealth.package.version === targetVersion
evidence.registryHealth.attempts.length >= 1
evidence.registryHealth.attempts[0].number === 1
evidence.registryHealth.attempts[0].cleanConsumer === true
```

Use `parseVersionProfile({ id, versions: resolved })` to validate that all six frozen version keys are exact and complete. Validate that requested Nuxt and Nuxt Content ranges are non-empty strings. Reject missing legacy `registryHealth`, incomplete profile, identity mismatch, no first attempt, or a non-investigation state before calling `verifyRegistryPackage`.

- [ ] **Step 4: Add RED cases for retry validation and classification**

Add rejection tests for a release-identity target mismatch, artifact package-version mismatch, registry-health package-version mismatch, and a frozen profile that differs from the first attempt. Each must reject before `verifyRegistryPackage` is called.

Then add table-driven classification tests starting with a first attempt classified as `package-defect` at `runtime`. Vary one allowed outcome dimension per row: first classification, retry classification, retry stage, and first-attempt `cleanConsumer`. Each valid retry that does not match all confirmation dimensions must remain `investigation`.

Add the one confirmed case:

```ts
expect(result.registryHealth).toMatchObject({
  status: 'unhealthy',
  attempts: [
    { number: 1, classification: 'package-defect', stage: 'runtime', cleanConsumer: true },
    { number: 2, classification: 'package-defect', stage: 'runtime', cleanConsumer: true },
  ],
})
```

- [ ] **Step 5: Implement retry transitions**

Always invoke the fixed runner again so `createWorkspace()` creates an independent clean consumer. Append, never replace, attempts. A successful retry sets `healthy`; a failed retry sets `unhealthy` only if the exact version, deep-equal frozen resolved profile, both `package-defect` classifications, identical package-user stage, and both clean-consumer flags match. Registry, network, runner, or permission failures remain `investigation` and retain the same retry command.

Write the complete updated release evidence once per completed retry and return it.

- [ ] **Step 6: Run the complete registry policy suite and typecheck**

Run: `pnpm test -- test/registrySmoke.test.ts`

Expected: PASS.

Run: `pnpm test:types`

Expected: PASS.

- [ ] **Step 7: Commit evidence-owned retry**

```bash
git add scripts/release-verification/registry-smoke.mjs scripts/release-verification/registry-smoke.d.mts test/registrySmoke.test.ts
git commit -m "feat: retry registry smoke from frozen evidence"
```

---

### Task 5: Integrate registry health with release, reconciliation, and CLI

**Files:**
- Modify: `scripts/release-verification/release.mjs:174-1068`
- Modify: `scripts/release-verification/release.d.mts:1-225`
- Modify: `test/releaseGate.test.ts`

**Interfaces:**
- Consumes: `createPendingRegistryHealth`, `runInitialRegistrySmoke`, `runRegistrySmokeRetry`, `RegistryHealthEvidence`, and `runRegistrySmokeVerification`.
- Produces: additive `LeanReleaseEvidence.registryHealth?`, `RegistrySmokeRetryRequest`, post-publication invocation, and `pnpm release registry-smoke <exact-version>` dispatch.

- [ ] **Step 1: Write failing CLI and compatibility tests**

Extend parsing expectations:

```ts
expect(parseReleaseArguments(['registry-smoke', '3.0.0'])).toEqual({
  mode: 'registry-smoke-retry',
  targetVersion: '3.0.0',
})
```

Reject missing version, `latest`, `v3.0.0`, ranges, and any third argument. Add a test that `runReleaseReconciliation` accepts a valid old evidence object with no `registryHealth` field.

- [ ] **Step 2: Run the focused release tests and verify RED**

Run: `pnpm test -- test/releaseGate.test.ts -t "registry-smoke|old evidence"`

Expected: FAIL because the request mode and additive field do not exist.

- [ ] **Step 3: Extend release types additively**

```ts
export interface RegistrySmokeRetryRequest {
  mode: 'registry-smoke-retry'
  targetVersion: string
}

export interface LeanReleaseEvidence {
  // keep every existing member unchanged
  registryHealth?: RegistryHealthEvidence
}
```

Add `id: string` to newly written `compatibilityProfile`, but read old evidence without it by using the fixed fallback ID `nuxt-4-actual-latest-release` only when initiating smoke after reconciliation.

- [ ] **Step 4: Add an injected registry verifier to release effects**

Extend `CreateReleaseEffectsOptions` with:

```ts
registryVerifier?: typeof runRegistrySmokeVerification
```

Expose an effect that calls the verifier with the shared `verificationOperations`. Preserve dependency injection so release tests never install from npm.

```ts
verifyRegistryPackage: (
  request: RegistrySmokeVerificationRequest,
) => Promise<RegistrySmokeVerificationEvidence>
```

- [ ] **Step 5: Write the post-publication RED tests**

Add one release test that asserts ordering and orthogonal state:

```ts
expect(effects.externalCalls).toEqual([
  'assert:fast-forward',
  'fast-forward',
  'assert:tag',
  'tag',
  'assert:push',
  'push',
  'assert:publish',
  'publish',
  'registry-smoke',
])
expect(result).toMatchObject({
  status: 'published',
  registryHealth: { status: 'healthy' },
})
```

Add a failing verifier case asserting the result still has `status: 'published'`, health becomes `investigation`, evidence includes the exact retry command, and no deprecate/publish/patch effect exists.

- [ ] **Step 6: Invoke smoke after every successful publication path**

After `evidence.status = 'published'` is durably written, call one private `recordRegistryHealth()` helper. It derives package identity from `evidence.artifact`, requested ranges and frozen versions from `evidence.compatibilityProfile`, assigns `createPendingRegistryHealth(...)` to `evidence.registryHealth`, and writes that pending state before contacting the registry. It then invokes `runInitialRegistrySmoke` and writes the settled `registryHealth` without changing the top-level status or `blocked` state.

Call the same helper after direct publish and both successful reconciliation outcomes. If a reconciliation reads evidence that already has `registryHealth`, return it without creating a duplicate first attempt.

- [ ] **Step 7: Dispatch evidence-owned retry**

Add `runReleaseRegistrySmokeRetry({ request, repositoryRoot, effects })`. It passes only repository root, exact target version, evidence reader/writer, `effects.verifyRegistryPackage`, and clock to `runRegistrySmokeRetry`. `runReleaseCli` dispatches `registry-smoke-retry` before reconciliation/release. There is no profile, stage, source, dist-tag, or deprecation option.

- [ ] **Step 8: Cover reconciliation and dispatch**

Test all three cases:

- reconciliation publishes an absent version, then creates its first registry attempt;
- reconciliation observes matching published integrity, then creates its first registry attempt;
- existing registry health prevents duplicate initial attempts.

Test CLI retry with an inert effect object and assert it reads `.release-evidence/<version>/release.json`, calls no resolver, and performs no publication effect.

- [ ] **Step 9: Run release, registry, runner, and operation suites**

Run: `pnpm test -- test/releaseGate.test.ts test/registrySmoke.test.ts test/releaseVerificationRunner.test.ts test/releaseVerificationOperations.test.ts`

Expected: PASS.

Run: `pnpm test:types`

Expected: PASS.

- [ ] **Step 10: Commit release integration**

```bash
git add scripts/release-verification/release.mjs scripts/release-verification/release.d.mts test/releaseGate.test.ts
git commit -m "feat: integrate registry health with release flow"
```

---

### Task 6: Add the maintainer recovery runbook

**Files:**
- Modify: `docs/en/RELEASING.md:1-110`

**Interfaces:**
- Consumes: the exact retry command and evidence statuses implemented in Tasks 3-5.
- Produces: one concise maintainer procedure; it defines no automation API.

- [ ] **Step 1: Add the registry smoke section**

Document the normal outcomes immediately after the existing publication section:

```md
## Registry health after publication

Publication and registry health are separate. `status: published` means npm
accepted the release; `registryHealth.status` reports whether a clean consumer
installed and ran that exact version with the recorded Version Profile.
```

Include `pnpm release registry-smoke 3.0.0` as the only retry command and state that it reads the frozen profile from `.release-evidence/3.0.0/release.json`.

- [ ] **Step 2: Add the one-page recovery sequence**

Cover these ordered actions with concrete commands:

1. Inspect the first attempt's stage, classification, requested profile, resolved profile, and diagnostics.
2. Fix registry/network/runner/permission infrastructure without changing the package version or profile.
3. Run `pnpm release registry-smoke 3.0.0` from an independent clean environment.
4. Treat only `registryHealth.status: unhealthy` as a confirmed package defect.
5. Manually deprecate only the exact version with `npm deprecate "@barzhsieh/nuxt-content-mermaid@3.0.0" "Use <known-good-version>; fix tracked in <issue-or-version>"`.
6. Prepare a normal corrective patch through `pnpm release <patch-version>` and verify its registry health.
7. State explicitly: never use `npm unpublish`; never move tags, auto-publish a patch, or perform automatic rollback.

- [ ] **Step 3: Check documentation and scope language**

Run: `rg -n "registryHealth|registry-smoke|npm deprecate|unpublish|candidate|automatic" docs/en/RELEASING.md`

Expected: the runbook contains health state, frozen retry, manual deprecation, corrective patch, and prohibition language; it contains no command that automates deprecation or unpublishing.

Run: `pnpm lint`

Expected: PASS.

- [ ] **Step 4: Commit the runbook**

```bash
git add docs/en/RELEASING.md
git commit -m "docs: add unhealthy release recovery runbook"
```

---

### Task 7: Verify the complete change and perform the required two-axis review

**Files:**
- Review: all changes since the implementation baseline recorded before Task 1.
- Modify only if verification or review identifies a task-related defect.

**Interfaces:**
- Consumes: all production, test, type, and documentation deliverables from Tasks 1-6.
- Produces: a clean verified branch and final task-related commit(s).

- [ ] **Step 1: Record the implementation review base before Task 1**

At execution start, before changing production code, run:

```bash
implementation_base=$(git rev-parse HEAD)
printf '%s\n' "$implementation_base"
```

Keep this task-specific value for the final three-dot review.

- [ ] **Step 2: Run formatting fixes and focused tests once more**

Run: `pnpm lint --fix`

Expected: exit 0; inspect `git diff` and keep only task-related formatting changes.

Run: `pnpm test -- test/releaseVerificationOperations.test.ts test/releaseVerificationRunner.test.ts test/registrySmoke.test.ts test/releaseGate.test.ts`

Expected: PASS.

- [ ] **Step 3: Run the complete required verification**

Run: `pnpm test`

Expected: PASS for the complete Vitest suite.

Run: `pnpm test:types`

Expected: PASS for root and playground type checks.

Run: `pnpm lint`

Expected: PASS with no ESLint errors.

- [ ] **Step 4: Inspect scope and prohibited behavior**

Run:

```bash
rg -n "npm (unpublish|deprecate)|dist-tag|rollback|database|automatic" scripts test package.json .github
```

Expected: no production code performs unpublish, deprecation, candidate promotion, automatic patch publication, rollback, or persistence-service work. The only deprecation command is human-facing documentation.

- [ ] **Step 5: Run the required code review from the fixed point**

Resolve and inspect the fixed point:

```bash
git rev-parse "$implementation_base"
git log "$implementation_base"..HEAD --oneline
git diff "$implementation_base"...HEAD --check
```

Invoke the repository `code-review` skill with `$implementation_base`. Run its Standards and Spec axes in parallel as required by that skill, using `AGENTS.md`, the repository guidelines, GitHub issue #58, and `docs/superpowers/specs/2026-08-09-registry-smoke-design.md` as sources.

- [ ] **Step 6: Resolve review findings and reverify**

For each actionable finding, add a failing focused test first, verify RED, make the smallest correction, verify GREEN, and rerun `pnpm test`, `pnpm test:types`, and `pnpm lint`. Record any non-actionable finding with the technical reason it does not apply.

- [ ] **Step 7: Commit any final review correction**

If review or formatting changed task files:

```bash
git add scripts/release-verification test docs/en/RELEASING.md
git commit -m "fix: address registry smoke review findings"
```

If no files changed, verify `git status --short` is empty and do not create an empty commit.
