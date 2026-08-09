# Release Verification

## Status and Scope

Accepted for the 3.x release line. This specification defines the release gate, the identity of the package being verified and published, ephemeral local evidence, idempotent publication, and post-publication registry health.

The release workflow has separate preparation and publication entrypoints around an explicit human Git handoff. It prepares and verifies one exact package artifact. It does not infer a patch, minor, or major version, reuse a previously packed artifact, or trust a stored CI result as release authorization.

## Release Identity and Side-effect Boundary

A release is identified by:

```ts
interface ReleaseIdentity {
  sourceCommit: string
  targetVersion: string
  artifactIntegritySha512: string
}
```

`sourceCommit` is the prepared local release commit from which the retained artifact was packed. `targetVersion` is an exact SemVer version newer than the current package version and absent from the registry when a fresh release begins. `artifactIntegritySha512` uses npm's `sha512-<base64>` Subresource Integrity representation so it can be compared directly with registry `dist.integrity`.

The clean formal `main` HEAD used to create the isolated worktree is recorded separately as `changeHeadCommit`. Previous release tags and a calculated release diff are not part of release identity.

`pnpm release:prepare <exact-version>` performs the complete pre-publication gate and stops after writing `status: verified`. Before that command returns it must not fast-forward the formal branch, create the final tag, contact a Git remote, or publish to npm.

The maintainer then fast-forwards
`main`, creates the final tag, pushes both refs atomically, and verifies the remote branch and peeled tag targets. These ordinary Git operations are an explicit human boundary and are not journal states inferred by the release program.

`pnpm release:publish <exact-version>` accepts only frozen verified evidence, revalidates local and remote refs plus the retained artifact, and reconciles the exact registry version by `dist.integrity` before deciding whether npm publication is necessary.

## Source and Artifact Preparation

CI and the release entrypoint share one source-verification interface:

```bash
pnpm verify:source
```

It runs lint, unit and browser-backed tests, and root and playground type checks. A release starts only from a clean formal `main` worktree, records `changeHeadCommit`, and requires a successful, determinate source-verification result. The release does not query GitHub Actions or require local HEAD to equal `origin/main`; publication later verifies the remote branch and tag directly.

Source verification excludes build, `prepack`, packing, and package-consumer verification. The only byte-producing lifecycle trusted by the release gate runs in an isolated worktree created from `changeHeadCommit`.

Preparation applies the exact target version and every release mutation that can affect build output or the npm packlist, including changelog and lockfile metadata, then creates one local prepared release commit. From that commit the workflow installs locked build dependencies and invokes pack exactly once. The resulting tarball is retained under `.release-evidence/<target-version>/`; its manifest and packlist are inspected and its npm SHA-512 integrity is recorded. No later phase rebuilds or repacks it.

## Gate Verification

The retained target-version artifact must pass the release Compatibility Profile defined by `v3-dependency-version-strategy.md`. The Clean Package User Consumer verifies required package contents, exports, public types, production build, startup, and a real non-empty Mermaid SVG. Any failure blocks formal-branch, tag, remote, and registry mutations.

Manual interaction verification is required by default. A maintainer may skip it only with an explicit argument and non-empty reason. When required, a clean consumer created from the same retained artifact and resolved profile must confirm:

- fullscreen entry and exit preserve the diagram and page state;
- zoom, pan, drag, and viewport recovery work;
- clipboard output matches the Mermaid source and feedback is truthful;
- controls remain usable at a narrow viewport; and
- labels, connectors, and controls remain readable without obvious clipping, overlap, or runaway sizing.

A missing or failed answer blocks the release. A source-linked playground is not valid package-consumer evidence.

## Local Evidence

The workflow writes an ordinary JSON maintainer journal under `.release-evidence/<target-version>/`. It is neither a tamper-resistant certificate nor an authorization token. It records at least:

- schema version and release status;
- `changeHeadCommit` and Release Identity;
- source-check command, outcome, and completion time;
- requested and resolved Compatibility Profile values and outcome;
- manual-check requirement, skip reason, and results; and
- timestamps for release phases.

Evidence and the retained tarball remain local and gitignored. Generated worktrees and consumer installation state are also never committed.

The workflow never trusts a stored `verified` or `published` value by itself. Before each external side effect it re-reads Git and artifact state, recalculates integrity, and checks the current Release Identity. Evidence writes are atomic so interruption cannot leave a partially trusted journal. A release-code or evidence-schema change invalidates existing evidence; old evidence is not migrated or reused.

An existing evidence directory blocks a new release attempt. After a pre-publication failure, the maintainer inspects and then moves or removes the whole directory before rerunning the full release. Individual phases and profiles are not resumed from stored success.

## Publication

After all automated and required manual checks pass, preparation stops with immutable `verified` evidence and a stable local preparation branch that keeps `sourceCommit` reachable. The maintainer owns the ordinary Git handoff that adopts that commit on formal `main`, creates the final annotated tag, pushes both refs atomically, and checks the remote targets.

Before npm access, the publication command verifies:

- the formal branch resolves to `sourceCommit`;
- formal `package.json` equals `targetVersion`;
- the retained artifact still matches `artifactIntegritySha512`;
- the artifact manifest name and version are correct; and
- the final local Git tag name and target commit are correct; and
- the remote `main` branch and peeled tag both resolve to `sourceCommit`.

Remote-ref mismatch or absence stops before npm access. Only then may publication use the retained tarball by explicit path. Publish may not run build, pack, `prepack`, `prepare`, or any other byte-producing lifecycle. Stable releases publish directly to the `latest` dist-tag.

## Idempotent Publication

Publication accepts only these outcomes:

1. Exact version absent: publish the retained tarball, then query the exact version again before recording `published`.
2. Exact version present with matching `dist.integrity`: record `published` without republishing.
3. Exact version present with different `dist.integrity`: stop with a fatal artifact conflict.
4. Registry query or publish result indeterminate: retain `verified` evidence and retry the same `release:publish` command later.

Publication cannot accept a different tarball, rebuild, repack, force-update refs, roll back a remote, or infer success from a command promise. A failed or indeterminate registry query is never evidence that the version is absent.

## Post-publication Registry Health

After the exact artifact is published to npm with `latest`, registry smoke proves that the exact version works for a clean Package User. It accepts only an exact SemVer package version and installs only `@barzhsieh/nuxt-content-mermaid@<version>` from the npm registry. Workspace, tarball, source, and dist-tag fallback inputs are invalid.

Artifact and registry checks share the Clean Package User Consumer core but use fixed named plans. Registry smoke runs exactly these stages:

1. install and verify the resolved installed manifest;
2. production build; and
3. production startup with a visible, non-empty Mermaid SVG assertion.

It does not repeat archive, export, public-type, or full-matrix checks.

The first Registry Smoke Test and its one permitted retry use the complete frozen `v3-known-latest` Version Profile stored in the release evidence. They do not resolve current registry latest versions and do not mutate the frozen profile.

## Registry-health Evidence and Recovery

Publication status and registry health are independent. The top-level `published` state continues to mean that the exact artifact was published. An additive `registryHealth.status` records one of `pending`, `healthy`, `investigation`, or `unhealthy`, and its attempts retain stage, classification, and frozen-profile evidence. Evidence created before this field existed remains readable.

A first registry-smoke failure does not turn successful publication into failure and does not automatically deprecate the version. It records the failed stage and retry command and sets registry health to `investigation`. Registry, network, runner, and permission failures remain infrastructure investigations.

A retry accepts only the exact target version and evidence location. It validates requested and resolved package versions, Release Identity, and the complete frozen profile before creating an independent clean consumer. It exposes no profile override.

Registry health becomes `unhealthy` only when the initial and retry attempts match on all of the following:

- exact package version;
- frozen resolved Compatibility Profile;
- package-defect classification;
- Package User-visible failure stage; and
- independent clean-consumer conditions.

Repeated failure at the same stage alone is insufficient. Recovery never republishes, repacks, promotes a dist-tag, or unpublishes. After investigation confirms an unhealthy package, a maintainer may deprecate only that exact version with a message pointing to a usable or forthcoming fixed version, then prepare and verify a corrective release through the normal gate.

## Verification Boundary

Implementation is complete only when focused tests prove:

- exact-version validation and Release Identity consistency;
- one-time artifact construction and integrity revalidation;
- failed or indeterminate source, package, compatibility, or manual gates prevent external side effects;
- explicit manual-skip reasons;
- all idempotent-publication outcomes without real publication;
- registry-only installation and resolved-version matching;
- fixed registry stages and frozen evidence-derived retry profiles;
- fail-closed evidence-schema validation;
- independence of publication and registry-health states; and
- first-failure investigation versus independently confirmed package-defect classification.

Tests inject command, Git, registry, filesystem, prompt, clock, and consumer effects. They never publish, deprecate, or unpublish a real package.
