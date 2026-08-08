# Lean release gate design

## Scope

Implement GitHub issue
[#56](https://github.com/andy820621/nuxt-content-mermaid/issues/56) as a
small, local-first publication gate for a single maintainer.

The design preserves two hard rules:

1. an unverified package cannot be published; and
2. the archive verified by the gate is the archive sent to npm.

The existing Clean Package User Consumer remains the package-level verification
seam. The release gate adds one deep external interface around it rather than a
new release framework:

```bash
pnpm release <target-version>
pnpm release reconcile <target-version>
```

The second form is a narrow recovery operation for an ambiguous publication,
not a general checkpoint/resume system.

## Side-effect boundary

Only irreversible or externally visible effects must wait for the gate. Before
the gate passes, the release entrypoint may create a disposable worktree,
prepare a local release commit, build, pack, and run verification. It may not
create the final Git tag, push commits or tags, or publish to npm.

This distinction removes the need to calculate a release mutation plan and
replay it later in the formal worktree. All filesystem mutations that can affect
build output or the npm packlist happen once in the isolated worktree. The
resulting prepared release commit becomes the exact commit adopted by the
formal branch after verification.

If preparation or verification fails, the disposable worktree and local
temporary branch can be removed and the release rerun. Once push may have
succeeded, the release switches to explicit publication reconciliation instead
of pretending it is a fresh run.

## Release identity

The release identity remains deliberately small:

```ts
interface ReleaseIdentity {
  sourceCommit: string
  targetVersion: string
  artifactIntegritySha512: string
}
```

`sourceCommit` is the prepared local release commit from which the archive was
packed. The clean repository HEAD before release preparation is recorded
separately as `changeHeadCommit`. It identifies both the source commit checked
locally and the input commit used to create the isolated worktree; it is not
part of `ReleaseIdentity`.

The release gate does not resolve or record a previous published tag and does
not calculate a release diff. No remaining gate decision consumes that
information. A future changelog or impact-analysis feature may resolve its own
base if it introduces a concrete need.

`artifactIntegritySha512` uses npm's `sha512-<base64>` Subresource Integrity
format so it can be compared directly with registry `dist.integrity`.

The entrypoint accepts an exact SemVer target rather than a patch/minor/major
mode. It validates that the target is newer than the current package version,
is not already published, and matches every later manifest and tag. No code
needs to infer or recalculate a target version.

## Source verification and release preparation

General source verification has one repository interface shared by CI and the
release entrypoint:

```bash
pnpm verify:source
```

That command runs the repository's required source checks:

- lint;
- unit and browser-backed tests; and
- root and playground type checks through `pnpm test:types`.

`.github/workflows/ci.yml` calls this command for pull requests and `main`
pushes. The release entrypoint calls the same command locally. The rule is
defined once even though it is executed independently in both environments.
The release does not query GitHub Actions, accept a stored CI result, or require
`HEAD` to equal `origin/main`.

The entrypoint starts only from a clean formal `main` worktree, records `HEAD`
as `changeHeadCommit`, and invokes `pnpm verify:source`. Any nonzero or
indeterminate result blocks the release. Remote divergence is handled later by
the normal fast-forward push: a rejected push stops the flow before publish.

`verify:source` deliberately excludes `prepack`, build, packing, and package
consumer verification. The existing `release:base` command cannot be reused
unchanged because it invokes `prepack`. The only release tarball and the only
byte-producing lifecycle trusted by the release gate belong to the isolated
archive construction below. CI may run other package-level regression jobs,
but their output is not an input to the local release gate.

The entrypoint then creates a disposable worktree at `changeHeadCommit` and
prepares the complete release there. Preparation applies the exact target
version plus changelog, generated metadata, lockfile metadata, and every other
release mutation that can affect build output or packlist. It creates one local
prepared release commit but does not create the final tag or contact a remote.

From that commit, the entrypoint installs locked build dependencies and invokes
pack exactly once. That single invocation runs the configured package lifecycle
and writes the retained tarball under `.release-evidence/<target-version>/`.
The entrypoint reads its manifest, records its packlist, and calculates the npm
SHA-512 integrity value. No later phase may rebuild or repack.

## Compatibility verification

Pull-request CI keeps the existing pinned Representative Compatibility Matrix
as reproducible source-level evidence for the supported Nuxt 3 and Nuxt 4
ranges. Release preflight does not rerun that full matrix.

The exact target-version tarball runs one release profile through the existing
Clean Package User Consumer:

- Nuxt 4 actual latest within the supported major; and
- Nuxt Content actual latest within its supported major.

The profile resolves versions at release time and records the requested ranges
and exact results. It installs the retained tarball and runs the existing
required package contents, exports, public types, production build, and basic
SVG checks. Any failure stops the release before the formal branch, tag, remote,
or registry changes.

Scheduled full actual-latest drift verification remains the responsibility of
the later Compatibility Drift ticket. It is not added to issue #56.

## Manual interaction check

The small release gate does not maintain a changed-path classifier or a
multi-category Release Impact Declaration. Manual interaction verification is
required by default. A maintainer may skip it only through an explicit argument
with a non-empty reason, for example:

```bash
pnpm release 3.0.1 --skip-manual "documentation-only release"
```

When required, the entrypoint creates a manual Clean Package User Consumer from
the same retained tarball and resolved release profile. It starts that consumer
and collects one pass/fail answer for each check:

- fullscreen can be entered and exited without losing the SVG or page state;
- zoom, pan, and drag work and the viewport can be recovered;
- clipboard output matches the Mermaid source and feedback is truthful;
- required controls and interactions remain usable in a narrow viewport; and
- labels, connectors, and controls remain readable without obvious clipping,
  overlap, or runaway sizing.

A missing or failed answer blocks the release. Individual explanations are not
required. A source-linked playground is never acceptable manual evidence.

## Local evidence

The entrypoint writes one ordinary JSON file under the gitignored
`.release-evidence/<target-version>/` directory. It is a maintainer journal, not
a tamper-resistant certificate and not an authorization token.

The file records at least:

```ts
interface LeanReleaseEvidence {
  schemaVersion: 1
  status: 'preparing' | 'blocked' | 'verified' | 'pushed' | 'published'
  changeHeadCommit: string
  sourceChecks: {
    command: 'pnpm verify:source'
    passed: boolean
    completedAt: string
  } | null
  identity: ReleaseIdentity | null
  compatibilityProfile: {
    requested: Record<string, string>
    resolved: Record<string, string>
    passed: boolean
  } | null
  manualCheck: {
    required: boolean
    reason: string
    results: Record<string, boolean> | null
  } | null
  timestamps: Record<string, string>
}
```

No canonical JSON, certificate digest, or permanent GitHub Release attachment
is required. Evidence updates may be atomic to avoid a truncated file, but the
release entrypoint never trusts a stored `verified` or `published` value by
itself. Before every external side effect it re-reads Git and the tarball,
recalculates integrity, and checks the current release identity.

The retained tarball is kept beside the evidence until publication succeeds or
the maintainer deliberately removes it. Generated evidence, tarballs,
worktrees, and consumer installation state are never committed.

## Publication

After all automated and required manual checks pass, the formal branch
fast-forwards to the already prepared `sourceCommit`. This adopts the exact
release mutations that produced the verified archive; it does not regenerate
them.

Before tag, push, and publish, the entrypoint verifies:

- the formal branch resolves to `sourceCommit`;
- formal `package.json` version equals `targetVersion`;
- the retained tarball still has `artifactIntegritySha512`;
- the tarball manifest name and version are correct; and
- the final Git tag name and target commit are correct.

Only then may it create the final tag, push the branch and tag, and publish the
retained tarball by explicit path. The publish phase may not run build, pack,
prepack, prepare, or another byte-producing lifecycle.

Stable releases publish directly to `latest`. Candidate promotion, staged
dist-tags, and automated rollback are outside this design.

## Publication reconciliation

If push succeeded but publish failed or returned an ambiguous result, the
archive and evidence are retained. The maintainer invokes the same entrypoint's
`reconcile` command. It first revalidates Git, tag, manifest version, archive
path, and SHA-512 integrity, then queries the exact registry version.

Reconciliation has three valid results:

1. the version is absent: retry publication with the same retained tarball;
2. the version exists with matching `dist.integrity`: record publication as
   successful and do not republish; or
3. the version exists with different `dist.integrity`: stop with a fatal
   artifact conflict.

A failed or indeterminate registry query remains blocked. It is never treated
as proof that the version is absent. Reconciliation cannot accept another
tarball or rebuild the package.

## Module shape and test seam

The initial implementation adds one external release interface and reuses the
existing release-verification modules:

```text
scripts/release-verification/
  release.mjs
  package-artifact.mjs
  runner.mjs
  operations.mjs
  profiles.mjs
```

Release-specific helpers remain private inside `release.mjs` until their
implementation becomes independently complex. File count is not used as a
proxy for architecture.

The entrypoint accepts one small effects object internally. Production supplies
real Git, command, registry, filesystem, prompt, and clock effects; focused
tests supply inert effects. This is the single side-effect seam needed to prove
that a failed gate never calls tag, push, or publish. It is not a general
dependency-injection framework.

Focused tests cover:

- exact target-version validation;
- prepared release identity and one-time archive construction;
- a nonzero or indeterminate shared source-check command stopping external
  effects;
- required package and manual failures stopping external effects;
- explicit manual-skip reasons;
- pre-publish identity and version mismatch failures; and
- all registry reconciliation outcomes without a real publication.

The existing Clean Package User Consumer remains the integration test seam for
the retained tarball.

## Explicit non-goals

Issue #56 does not add:

- a six-category Release Impact Declaration or agent recommendation schema;
- automatic changed-path impact classification;
- release-time execution of the complete compatibility matrix;
- canonical JSON or a cryptographic evidence certificate;
- general checkpoint/resume orchestration;
- GitHub Actions status lookup or remote CI attestation;
- a GitHub Actions release workflow or workflow-artifact persistence;
- permanent evidence on GitHub Releases;
- candidate promotion, automatic rollback, or incident automation; or
- scheduled compatibility drift handling.

These capabilities may be added only after a concrete maintenance problem
justifies their cost.
