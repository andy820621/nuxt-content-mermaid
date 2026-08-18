# Releasing

A stable release has one durable starting point: an immutable annotated version
tag on a verified `main` commit. Pushing that tag starts
`.github/workflows/publish.yml`, which verifies one tarball, publishes that exact
tarball to npm through Trusted Publishing, and then creates the GitHub Release.

The maintainer owns the PR and tag. The workflow owns packing, artifact
verification, npm publication, and GitHub Release creation.

## 1. Prepare one ordinary PR

Create a branch from the latest clean `origin/main`. Put the product change,
release-pipeline maintenance, version, and changelog required for one release in
the same reviewable PR, using separate logical commits when useful.

Prepare the version without creating a commit, tag, GitHub Release, or npm
publication:

```bash
pnpm changelogen --release -r X.Y.Z --no-commit --no-tag --no-github
pnpm install --lockfile-only --ignore-scripts
```

Review the generated notes. The PR must contain:

- the exact stable version `X.Y.Z` in `package.json`;
- a matching `## vX.Y.Z` section in `CHANGELOG.md`;
- migration guidance for every Package User-visible incompatibility;
- the commands and results used to validate the change; and
- the tracking Issue reference.

Do not commit `dist` or a package archive. CI and the release verifier build
those outputs from source.

Before merge, require the existing checks:

- `source-verification`;
- `final-compatibility-profiles (v3-minimum, 22.19.0)`;
- `final-compatibility-profiles (v3-known-latest, 24.19.0)`; and
- the Conventional PR title check.

Squash-merge the PR without bypassing failed required checks, then update the
local `main` with `git pull --ff-only origin main`.

## 2. Create the release tag

Confirm that `main` is clean, its version and changelog match, and CI passed for
the exact HEAD. Create and verify an annotated tag:

```bash
version=X.Y.Z
release_commit=$(git rev-parse HEAD)
git tag -a "v$version" "$release_commit" -m "v$version"
git cat-file -t "v$version"
git rev-list -n 1 "v$version"
git push origin "refs/tags/v$version"
```

`git cat-file` must print `tag`, and `git rev-list` must print the verified
`main` commit. Never force-move a release tag. The tag is both the release
trigger and the immutable record of what the version identifies.

## 3. Monitor the publish workflow

The tag starts the single `publish` job. It:

1. verifies that the ref is an annotated stable SemVer tag targeting the
   checked-out commit;
2. verifies tag, `package.json`, and `CHANGELOG.md` identity;
3. installs frozen dependencies with the repository-pinned pnpm;
4. packs exactly once into an empty retained directory;
5. checks package contents, archive safety, exports, public types, a fresh
   consumer production build, and basic browser SVG rendering;
6. publishes that same `.tgz` with npm Trusted Publishing, provenance, `latest`,
   and lifecycle scripts disabled; and
7. creates the matching GitHub Release only after npm succeeds.

The workflow does not accept manual dispatch, reconstruct state across jobs, or
install the newly published package from the registry. Successful completion of
the one job means the release is complete.

Verify the public state independently:

```bash
npm view @barzhsieh/nuxt-content-mermaid@X.Y.Z version dist-tags.latest --json
gh release view vX.Y.Z --json tagName,isDraft,isPrerelease,url
```

Also confirm that npm displays provenance and `latest` points to `X.Y.Z`. Add
the npm, workflow, and GitHub Release links to the tracking Issue, then close it.

## npm Trusted Publisher setup

Keep npm **Settings → Trusted Publisher** bound to:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `andy820621` |
| Repository | `nuxt-content-mermaid` |
| Workflow filename | `publish.yml` |
| Environment | blank |
| Allowed actions | `npm publish` only |

The exact workflow filename is part of npm's trust binding. Do not rename it or
add an `NPM_TOKEN`/`NODE_AUTH_TOKEN` fallback. The workflow requests job-level
`id-token: write` for OIDC and `contents: write` for the GitHub Release.

## Failure recovery

An npm version and a release tag are immutable facts. Diagnose external state
before retrying an ambiguous operation, and never overwrite, unpublish, or
force-move them.

| Failure point | Recovery |
| --- | --- |
| PR or pre-tag verification fails | Fix the original branch and rerun the complete validation. |
| Tag workflow fails before npm because of transient infrastructure | Rerun the same tag workflow. |
| Tag workflow finds a deterministic source or artifact defect before npm | Keep the tag unchanged; fix `main` and prepare the next patch version. |
| `npm publish` result is ambiguous | Query the exact version first. Rerun only if it is absent; never publish again when it exists. |
| npm succeeds but GitHub Release creation fails | Create the GitHub Release for the existing tag with `pnpm changelogen gh release X.Y.Z`; do not rerun publication. |
| The published package is defective | Deprecate that exact version and publish a corrective patch; do not overwrite or unpublish it. |
| Tag, npm version, or GitHub Release identity conflicts | Stop and reconcile the external state manually. Do not force a tag or assume success. |

## Documentation website

Website synchronization is an ordinary follow-up after the package release. A
delayed or failed website deployment does not change npm, tag, or GitHub Release
state and must not cause republishing. Repair documentation through an ordinary
PR or deployment retry.
