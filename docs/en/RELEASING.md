# Releasing

Release preparation, Git publication, and npm publication are separate boundaries.
The program owns reproducible verification and exact-tarball npm reconciliation;
the maintainer owns the ordinary Git handoff.

## Before starting

- Check out `main` and leave its worktree clean.
- Install dependencies and ensure npm authentication can publish
  `@barzhsieh/nuxt-content-mermaid`.
- Ensure [Volta](https://volta.sh/) is available. Preparation runs each frozen
  Compatibility Profile under its exact Node runtime.
- Choose an exact SemVer greater than `package.json`. It must not already exist
  in npm.
- Determine whether the playground production build is required. Run
  `pnpm dev:build` before every major or minor release, and for any release whose
  changes affect Nuxt Content integration, runtime registration, build
  configuration, or relevant dependencies. Record the command and result in the
  release checklist or the PR's Validation section. This is a risk-based
  release-readiness check, not part of CI or `verify:source`.
- Ensure `.release-evidence/<version>/` does not exist. Release evidence is
  ephemeral and is never overwritten or migrated.
- Do not change the package version, create the final tag, or publish manually.

## Prepare and verify

Run the complete pre-publication gate:

```bash
pnpm release:prepare 3.0.0
```

Preparation runs `pnpm verify:source`, creates an isolated release commit, packs
exactly once, retains that tarball under `.release-evidence/3.0.0/`, freezes the
`v3-minimum` and `v3-known-latest` profiles, verifies both profiles, and performs
the required manual interaction checks. It stops at `status: verified`; it does
not change formal `main`, create the final tag, contact a Git remote, or publish
to npm.

For a release that genuinely does not need interaction verification, record an
explicit non-empty reason:

```bash
pnpm release:prepare 3.0.1 --skip-manual "documentation-only release"
```

Inspect `.release-evidence/3.0.0/release.json` without editing it. Record these
values for the handoff:

- `identity.sourceCommit`: the prepared commit that produced the artifact;
- `preparationBranch`: normally `release-prep/v3.0.0`;
- `identity.artifactIntegritySha512`: the retained tarball's npm SHA-512; and
- `artifact.archivePath`: the only tarball publication may use.

Any release-code, evidence-schema, manifest-range, Version Profile, source, or
artifact change invalidates the evidence. Inspect and move or remove the whole
evidence directory, then prepare again; never migrate or reuse stale evidence.

## Perform the Git handoff

With `<sourceCommit>` copied from the frozen evidence, run:

```bash
git merge --ff-only <sourceCommit>
git tag -a v3.0.0 <sourceCommit> -m "v3.0.0"
git push --atomic origin main v3.0.0
git ls-remote origin refs/heads/main refs/tags/v3.0.0 'refs/tags/v3.0.0^{}'
```

Visually compare both the remote `main` object and the peeled
`refs/tags/v3.0.0^{}` object with `identity.sourceCommit`. Do not proceed unless
both match. The direct tag object may differ because an annotated tag has its
own object; the peeled target must equal the source commit.

These are explicit maintainer-owned Git operations, not release-journal states.
Never force-update the branch or tag through the release program.

## Publish the frozen tarball

After the local and remote refs have been verified, run:

```bash
pnpm release:publish 3.0.0
```

Publication independently revalidates the clean local `main`, local tag, remote
`main`, peeled remote tag, manifests, retained archive path, SHA-256, and npm
SHA-512 before npm access. It queries the exact registry version first:

- absent: publish the retained tarball with lifecycle scripts disabled, then
  query the exact version again before recording `published`;
- present with matching `dist.integrity`: record `published` without
  republishing; or
- present with different `dist.integrity`: stop with a fatal artifact conflict.

It never rebuilds, repacks, accepts another tarball, or infers success merely
from the npm command response.

After publication and Registry Smoke complete successfully, remove the local
reachability anchor:

```bash
git branch -d release-prep/v3.0.0
```

## Narrow recovery rules

### Preparation failure

The program removes the disposable worktree and preparation branch after a
failed preparation. Inspect the invalid evidence directory, then move or remove
that whole directory and rerun `pnpm release:prepare 3.0.0`. Do not reuse any
partial artifact or profile result.

### Local handoff completed but push not confirmed

If local `main` was fast-forwarded but push has not succeeded, do not rerun
preparation. Correct the local annotated tag if needed and continue from the
frozen evidence.

If the atomic push reports an error or its response is lost, run:

```bash
git ls-remote origin refs/heads/main refs/tags/v3.0.0 'refs/tags/v3.0.0^{}'
```

- If both remote targets resolve to `sourceCommit`, proceed to npm publication.
- If neither ref exists, rerun the same atomic push.
- If only one ref matches, or either points elsewhere, stop for manual Git
  diagnosis. Do not force-update, roll back, replace a tag, or start a new
  release through the program.

### npm result is ambiguous

Rerun the same idempotent command:

```bash
pnpm release:publish 3.0.0
```

It rechecks local and remote identity and the exact npm `dist.integrity` before
deciding whether publication is still necessary. Indeterminate lookup or
publication evidence remains `verified` with `lastFailure`; keep the frozen
evidence and retained tarball in place.

### Registry Smoke failure

Publication and registry health are independent. A first Registry Smoke failure
records `registryHealth.status: investigation` without reversing publication.
After infrastructure diagnosis, use only this one retry:

```bash
pnpm release:registry-smoke 3.0.0
```

The first attempt and retry both use the complete frozen `v3-known-latest`
profile stored in the release evidence. They never resolve current registry
latest versions or accept a profile override.

Treat only `registryHealth.status: unhealthy` after the independent retry as a
confirmed package defect. A maintainer may then manually deprecate only that
exact version and prepare a normal corrective release. Never unpublish,
auto-deprecate, auto-publish a patch, move a dist-tag, or perform automatic
rollback.

## Evidence boundary

`.release-evidence/<version>/release.json` and the retained tarball are local,
gitignored, ephemeral evidence. The journal records facts proven by the script:
`verified` means the source and retained artifact passed every gate; `published`
means the exact npm version has matching integrity. Git publication remains a
human-owned boundary that `release:publish` rechecks rather than inferring from
a timestamp.
