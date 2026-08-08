# Release gate design

## Scope

Implement GitHub issue
[#56](https://github.com/andy820621/nuxt-content-mermaid/issues/56) as the
blocking publication boundary for the existing Release Verification Contract.
The release flow produces and verifies one target-version package archive,
records a complete Release Impact Declaration and any required Manual
Interaction Verification, and permits versioning, tag/push, and publication
only after an immutable preflight certificate exists.

This design deepens the existing Clean Package User Consumer and Representative
Compatibility Matrix. It does not create a second consumer project or move
release rules into GitHub Actions.

Candidate promotion, permanent GitHub Release evidence storage, automatic Git
rollback, automatic incident handling, and post-publication Registry Smoke Test
policy remain outside issue #56.

## Mental model and invariants

The package archive is the release artifact seam. A release is identified by
exactly this tuple:

```ts
interface ReleaseIdentity {
  sourceCommit: string
  targetVersion: string
  artifactIntegritySha512: string
}
```

`artifactIntegritySha512` uses npm's Subresource Integrity representation,
`sha512-<base64>`, so the same value can be compared directly with registry
`dist.integrity`.

The source tree identity, previous published release, release mutation plan,
release commit, and tag are evidence about that release, but are not additional
members of `ReleaseIdentity`:

- `sourceCommit` is the clean, committed source from which the release begins.
- The source tree object is recorded alongside the commit so uncommitted or
  mismatched source cannot masquerade as that commit.
- The previous published release commit and tag define the Release Impact
  Declaration base.
- `targetVersion` is calculated exactly once before staging. Every later
  versioning operation receives that exact value and may not recalculate it.
- The release commit and tag are results created only after preflight succeeds.
- The archive named by `artifactIntegritySha512` is retained and published
  directly. No later build or pack may replace it.

The release entrypoint fails unless the formal working tree is clean. This
makes the source commit and tree truthful, gives the diff a stable head, and
ensures the isolated staging worktree starts from reproducible source.

## Architecture

One release entrypoint owns a fail-closed state machine. Package scripts and
release workflow adapters delegate to this entrypoint instead of composing
versioning and publication with shell `&&` chains.

The implementation is divided into four deep modules:

1. **Release contract** parses the Release Impact Declaration, evidence bundle,
   immutable certificate, manual results, and release identity. It owns schema
   versions, validation, canonical serialization, and certificate digest
   verification.
2. **Release preflight** coordinates source and diff discovery, the release
   mutation plan, isolated artifact construction, actual-latest resolution,
   Clean Package User verification, the conditional manual gate, and
   certificate sealing.
3. **Release orchestration** consumes only a verified certificate before it may
   apply formal versioning, create the release commit and tag, push, reconcile
   registry state, or publish the archive.
4. **Operations and persistence adapters** perform Git, registry, process,
   filesystem, clock, interactive-browser, and evidence-storage work. GitHub
   Actions artifact upload and the local `.release-evidence/` directory are
   persistence adapters rather than domain rules.

Each coordinator receives its operations as an explicit dependency. Focused
tests observe coordinator inputs, evidence, and side-effect authorization
without asserting private shell commands or workflow job names.

## Target version and release mutation plan

The entrypoint accepts a release mode and may accept an expected target version
from release orchestration. It first verifies that the formal manifest version
matches the previous version resolved from the registry, then calculates the
target version once from that version and the release mode. An expected version
is a guard and must equal the calculated value; it is not a second source of
truth. The exact calculated version is passed to staging and formal versioning.

Before packing, the entrypoint computes an immutable Release Mutation Plan.
This plan contains every release-time filesystem mutation that can affect the
packlist or build output, including:

- package manifest versions and related workspace or lockfile metadata;
- changelog or release-note content generated for the release;
- generated package metadata;
- any other configured release mutation read by a pack lifecycle or included
  in the npm packlist.

Changing only `package.json.version` in staging is insufficient. The same plan
is applied first to an isolated staging worktree and, after the gate succeeds,
to the formal worktree. Its canonical digest is recorded in evidence. A
mutation that cannot be represented or replayed deterministically blocks the
release instead of being deferred until after preflight.

The staging sequence is:

1. create a detached, isolated worktree at `sourceCommit`;
2. apply the complete Release Mutation Plan;
3. install build dependencies from the locked dependency graph;
4. invoke pack exactly once into the release run's retained artifact directory,
   allowing that invocation's configured lifecycle hooks to produce build
   output and determine the packlist; those byte-producing hooks are not run a
   second time for this archive;
5. read the archive manifest and packlist, calculate
   `artifactIntegritySha512`, and bind them to the release identity; and
6. remove disposable staging state without deleting the retained archive or
   evidence.

No preflight profile may rebuild or repack. Every automated and manual consumer
receives the retained archive by explicit path.

## Release diff and Release Impact Declaration

The release diff base is the previous version already published to the
applicable registry dist-tag. The entrypoint resolves that version, requires
its corresponding local Git tag, records the tag and commit, and verifies that
the commit is an ancestor of `sourceCommit`. The diff head is exactly
`sourceCommit`.

Evidence records:

- previous published version, tag, and commit;
- head commit and source tree object;
- the canonical diff digest and changed paths; and
- the Release Impact Declaration bound to that base and head.

The Release Impact Declaration is explicit, schema-versioned input. It contains
one entry for each required category:

- package contents;
- runtime behavior;
- interaction;
- styling;
- browser APIs; and
- runtime dependencies.

Each entry records an agent recommendation of `yes`, `no`, or `unknown`, a
non-empty diff-based reason, and the maintainer's final value. Maintainer
provenance includes identity, confirmation time, and a reason whenever the
maintainer changes the recommendation. The declaration is invalid if any
category, reason, final confirmation, or provenance field is missing, or if its
base/head identity differs from the release diff.

The implementation validates structure and identity; it does not pretend to
prove that natural-language reasoning is semantically correct. Maintainer
confirmation remains the authority for the final classification.

## Required automated verification

Release preflight resolves the registry's actual latest version inside each
supported major at release time and records both the requested range and exact
resolved version. The required release profiles are:

- Nuxt 3 minimum with Nuxt Content minimum;
- Nuxt 4 minimum with Nuxt Content minimum;
- Nuxt 3 actual latest with the supported Nuxt Content major's actual latest;
  and
- Nuxt 4 actual latest with the supported Nuxt Content major's actual latest.

These profiles preserve public lower-bound evidence without substituting
latest-only verification. Runtime dependencies required by the clean consumer
remain explicit Version Profile inputs and their requested and resolved values
are recorded.

All profiles reuse the existing consumer template, the same retained archive,
and the same Package User assertions. Every required install, package contents,
exports, public types, production build, and basic SVG stage must pass. Lookup
or infrastructure failures are classified separately from consumer failures,
but both keep the release blocked in issue #56; scheduled clean-retry and drift
incident policy belong to the later Compatibility Drift ticket.

The evidence for each stage records status, timing, profile identity, requested
versions, resolved versions, and a structured failure classification when
applicable.

## Manual Interaction Verification

The maintainer's final Release Impact Declaration controls the manual gate:

- all six final values are `no`: record a complete skip decision and its
  rationale;
- any final value is `yes` or `unknown`: require the entire manual suite; and
- a missing or failed manual result: keep the release blocked.

The suite is all-or-none and covers fullscreen, zoom/pan/drag, clipboard,
mobile interaction, and visual readability using the pass criteria in issue
#56. It is not automated by this ticket.

When triggered, the entrypoint materializes a dedicated Clean Package User
Consumer from the same retained tarball and a recorded actual-latest Version
Profile. It starts that consumer for the maintainer and records the installed
package identity, artifact integrity, resolved dependency versions, verifier
identity, verification time, and result of every checklist item. A
source-linked playground or repository fixture is never acceptable manual
evidence.

The entrypoint may checkpoint while awaiting human results and resume the same
release run without moving or regenerating the archive. Manual results are
accepted only when they attest the current release identity and manual consumer
profile.

## Evidence contract

The schema-versioned JSON evidence bundle is the release gate's authoritative
output. Its data contract is independent from its storage location.

The bundle has two intentionally different layers:

```ts
interface ReleaseEvidenceBundle {
  schemaVersion: 1
  runId: string
  checkpoint: MutableReleaseCheckpoint
  preflightCertificate: ImmutablePreflightCertificate | null
  releaseOutcome: MutableReleaseOutcome
}
```

The mutable checkpoint records progress before the gate and subsequent
version/tag/push/publish attempts. It is atomically rewritten after meaningful
state transitions so interruption and failure still leave actionable evidence.
Adapter-specific artifact locators may live in this mutable layer, not in the
portable certificate.

The preflight certificate is absent until every required automated and manual
gate passes. Its payload contains at least:

- the exact release identity;
- source tree identity and Release Mutation Plan digest;
- target package name and archive manifest version;
- release diff identity;
- artifact filename, npm packlist evidence, size, and integrity;
- requested and resolved versions for every required profile;
- every required stage result;
- the full confirmed Release Impact Declaration;
- the manual gate trigger, skip reason, or complete results and provenance; and
- certificate completion time.

The certificate is serialized canonically with lexicographically stable object
keys. Its digest uses `sha256-<base64>` over the canonical UTF-8 payload before
the digest field is attached. Once written, the certificate payload and digest
are immutable. Later checkpoint or release-outcome updates may not alter them.
Every load and resume recomputes the digest and fails fatally if it differs.

Thus the mutable evidence bundle is an operational journal, while the frozen
certificate is the gate authority. A successful checkpoint without a valid
certificate can never authorize a release side effect.

## Release side-effect boundary

After certificate verification, the entrypoint applies the already sealed
Release Mutation Plan to the formal clean worktree. It creates the release
commit and tag, records them as results, and verifies that the release commit's
parent is `sourceCommit` and the tag resolves to that release commit before
push.

Immediately before publication, the entrypoint rechecks:

- the certificate digest and release identity;
- the retained archive's SHA-512 integrity;
- formal `package.json` version;
- release commit and tag version;
- archive manifest name and version; and
- the applied Release Mutation Plan identity.

All versions must equal `targetVersion`. Publication then uses the retained
archive's explicit path. The publish phase may not invoke build, pack, prepack,
prepare, or any other byte-producing lifecycle again.

Stable release mode publishes directly to `latest`; no candidate dist-tag or
promotion phase is introduced. Existing explicit prerelease modes may continue
to select their established dist-tags through the same entrypoint, but they do
not form a promotion workflow.

## Publish reconciliation and resume

If push succeeds but publish fails or its response is ambiguous, the entrypoint
preserves the archive and evidence and records a resumable publish checkpoint.
Resume always revalidates certificate, artifact integrity, formal version, tag,
and source ancestry before querying the registry for the exact package version.

Registry reconciliation has exactly three outcomes:

1. **Version absent:** publication may be retried with the same retained archive.
2. **Version present with matching `dist.integrity`:** no new publish occurs;
   the run is reconciled as a previously successful publish.
3. **Version present with different `dist.integrity`:** stop with a fatal
   artifact conflict.

A registry lookup failure or indeterminate response remains blocked and may not
be treated as absence. Resume never rebuilds, repacks, or accepts a replacement
archive.

No automatic Git rollback is attempted after a versioning, tag, push, or
publish failure. The evidence records the exact reached state so recovery does
not guess which side effects occurred.

## Persistence adapters

The default local adapter stores a run under a gitignored
`.release-evidence/` directory. The output path is configurable. Evidence is
written through a temporary sibling file followed by an atomic rename; the
archive is retained until publication succeeds or the maintainer deliberately
removes the run.

The GitHub Actions adapter uploads the same JSON file and retained archive as a
workflow artifact, including on failure. Workflow YAML passes release inputs
and configures storage, but does not resolve versions, classify impact, decide
manual gates, interpret evidence, or publish independently of the entrypoint.

Attaching the same JSON to a GitHub Release may be added later as another
persistence adapter. It is not implemented by issue #56. Generated evidence,
the retained archive, staging worktrees, and consumer installation state are
never committed to the repository.

## Failure behavior

All invalid, missing, stale, or indeterminate state fails closed. In particular:

- an invalid declaration or missing maintainer provenance prevents artifact
  verification from authorizing release;
- target-version disagreement prevents staging;
- a release diff that does not end at `sourceCommit` prevents classification;
- any required automated stage failure prevents certificate creation;
- any required manual result that is missing or failed prevents certificate
  creation;
- a missing, changed, or digest-invalid certificate prevents every release
  side effect;
- formal version, tag, mutation-plan, archive manifest, or integrity mismatch
  prevents publication; and
- registry uncertainty prevents publish retry.

Evidence-writing failure is itself blocking because the gate cannot prove its
decision without its authority record.

## Verification seams and TDD sequence

The following public seams were approved before implementation:

1. Release Impact Declaration and evidence JSON parsers/validators.
2. Release preflight and orchestration request-to-evidence behavior with
   injected operations, including proof that version/tag/push/publish adapters
   are never called before a valid certificate exists.
3. The existing Clean Package User Consumer running minimum and actual-latest
   profiles against one retained archive.
4. The release CLI's inputs, exit status, configurable evidence path,
   checkpoint/resume behavior, and fail-closed output.
5. Publish reconciliation using exact registry `dist.integrity` and the same
   retained archive.
6. Manual Interaction Verification setup proving that its consumer installs the
   certificate's archive rather than repository source.

Implementation proceeds in vertical red-green slices:

- declaration and evidence contracts, canonical certificate sealing, and
  tamper rejection;
- source/diff discovery and one-time target-version calculation;
- release mutation planning and isolated exact-archive production;
- actual-latest resolution and required profile evidence;
- conditional same-archive manual verification;
- certificate-gated version/tag/push/publish orchestration;
- publish reconciliation and resume; and
- local/CI persistence adapters and maintainer documentation.

Focused Vitest files and typechecking run after each relevant slice. The full
test suite, type checks, lint, package contract, representative package checks,
and production build run once at completion before code review.
