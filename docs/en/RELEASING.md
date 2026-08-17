# Releasing

Every stable release has exactly two release-critical maintainer actions:

1. Create, review, and merge a Release PR.
2. From GitHub Actions on `main`, run **Publish stable release** with the stable
   exact version from that PR.

The workflow owns the immutable tarball, npm Trusted Publishing, public-registry
verification, annotated tag, and GitHub Release. Do not create those release
objects manually. After `finalize`, perform the independent Website
Synchronization procedure below. A delayed website update never changes whether
the package release completed successfully.

## 1. Create and merge the Release PR

Start from a clean branch based on the current `main`, then prepare the version,
changelog, and lockfile:

```bash
pnpm release:prepare-pr 3.0.0
```

The version must be an exact stable `x.y.z`. The helper may change only
`package.json`, `CHANGELOG.md`, and `pnpm-lock.yaml`; it does not commit, tag,
push, create a GitHub Release, or publish. Review all three files and commit the
intended changes before opening the PR.

Keep the **Release PR** section in the PR template and complete it:

- Set **Target version** to the exact version in `package.json`.
- For every Release Impact Declaration (RID) dimension, choose `affected`,
  `unaffected`, or `uncertain` and provide concrete evidence. The six dimensions
  are package contents, runtime behavior, interaction, styling/layout, browser
  APIs, and runtime dependencies.
- Manual Interaction Verification (MIV) is required when interaction,
  styling/layout, or browser APIs is `affected` or `uncertain`. Set **Required**
  to `yes` and record the test commit, environment, scenarios, and result. Set it
  to `no` only when none of those three dimensions triggers MIV.

Wait for the existing required checks and review, then merge the Release PR.
`source-verification` validates the target, all six RID entries, and conditional
MIV; ordinary PRs remove the Release PR section.

### If `main` advances after the merge

Do not dispatch a release for a commit that the merged Release PR did not cover.
Create and merge a replacement Release PR from the new `main`. It must keep the
target marker, account for the intervening diff in `CHANGELOG.md`, and provide a
fresh RID/MIV assessment for the complete release commit.

The same target version may be reused only while that exact version does not
exist on npm. If it already exists, stop and reconcile the external state before
choosing a corrective version.

## 2. Run the Publish workflow

In GitHub:

1. Open **Actions** → **Publish stable release**.
2. Choose **Run workflow**, select `main`, and enter the exact version merged by
   the current Release PR.
3. Start the run and monitor every job through `finalize`.

The workflow fails closed unless it is a manual dispatch from the current
`main`, the package and changelog match the version, the current commit is
covered by a merged Release PR, npm state is safe, and tag/Release state does
not conflict.

Read the job graph as a durability boundary:

| Job | Meaning when complete |
| --- | --- |
| `verify-and-pack` | Source and Release PR identity passed; one tarball and its checksum were created. npm is unchanged. |
| `smoke` | The same tarball passed `v3-minimum` on Node 22.19.0 and `v3-known-latest` on Node 24.19.0. npm is unchanged. |
| `publish` | The tarball's exact integrity is present on npm and `latest` points to it. |
| `registry-smoke` | A fresh consumer passed against the exact public npm version. No tag or GitHub Release exists yet. |
| `finalize` | The annotated `vX.Y.Z` tag targets the workflow commit and the matching GitHub Release exists. |

Only a run that completes `finalize` is a completed release.

## 3. Synchronize the documentation website

Website Synchronization starts only after the publish workflow completes
`finalize`. The
[production documentation site](https://nuxt-content-mermaid.barz.app) is the
canonical package documentation, while the repository READMEs remain bounded
distribution summaries.

1. Compare the released changelog and public package surface with the canonical
   English documentation source.
2. If the canonical content already describes the released behavior, verify the
   affected production routes and record that no content change was required.
3. If documentation changed, open an ordinary documentation PR that updates the
   English source first and the Traditional Chinese best-effort translation in
   the same information architecture.
4. After that PR merges, wait for the resulting production documentation
   deployment and verify the affected routes, navigation, canonical URLs,
   sitemap, hydration, and browser console on the production origin.

Website Synchronization is not part of npm, tag, or GitHub Release durability.
If it is delayed or its deployment fails, keep the successful package release
unchanged, track the pending documentation work in an issue, and repair it
through an ordinary PR or deployment retry. Do not unpublish, republish, move a
tag, replace a GitHub Release, or roll back package state because the website is
pending.

## One-time npm Trusted Publisher setup

After this workflow lands and before its first real release, configure the npm
package **Settings → Trusted Publisher** with these exact values:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `andy820621` |
| Repository | `nuxt-content-mermaid` |
| Workflow filename | `publish.yml` |
| Environment | Leave blank |
| Allowed actions | `npm publish` only |

The package may have only one Trusted Publisher. Update any existing publisher
to these values and verify them character-for-character because npm does not
validate the binding when it is saved. Do not create an `NPM_TOKEN` secret.

No GitHub repository setting change is currently required: the workflow requests
its job-level `id-token` and `contents` permissions, and the existing required
checks retain their names. If organization policy later blocks OIDC or one of the
workflow's official action majors, stop before publishing instead of adding a
token fallback.

After the first successful OIDC publication, set npm **Publishing access** to
**Require two-factor authentication and disallow tokens**, then revoke the old
automation token.

## Failure recovery

Prefer **Re-run failed jobs** on the same workflow run whenever the table allows
it. This preserves the original artifact. Never overwrite an npm version,
force-move a tag, replace a conflicting GitHub Release, or infer success from an
ambiguous response.

| Failure point | Recovery |
| --- | --- |
| Preflight, source, pack, or compatibility fails before npm access | Fix the problem through a new Release PR. If `main` and the release baseline have not changed, rerunning failed jobs on the original run is also safe. Reuse the target version only while the exact npm version is absent. |
| The `npm publish` response is ambiguous | Re-run the failed jobs on the same run. The publish job downloads the original artifact, verifies its checksum, and uses exact registry state to publish, skip, or stop. Do not bump, repack, or publish manually first. |
| The exact npm version exists with matching integrity | Treat it as the same release. Publishing is skipped and the workflow continues through post-check, Registry Smoke, and finalization. |
| Exact integrity, `latest`, tag, or GitHub Release conflicts, or a lookup is indeterminate | Stop. Do not move the dist-tag, rebuild the tag, or overwrite the Release. Reconcile the external state manually, then use a corrective PR or a dedicated recovery issue. |
| Registry Smoke fails transiently | Re-run the failed job on the same run. Keep the npm version unchanged; tag and GitHub Release have not been created. |
| Registry Smoke confirms a package defect | Do not overwrite or unpublish the version. Deprecate that exact version, prepare a corrective Release PR, and run a complete new release. |
| Finalization partially fails | Re-run the failed `finalize` job. Matching annotated-tag and Release state is completed idempotently; any different target stops the run. |
| The original workflow artifact expired | Start a new dispatch. Its newly packed artifact must match the exact npm integrity before the workflow may continue; otherwise stop and open a recovery issue. |
