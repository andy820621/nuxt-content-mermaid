# Releasing

The release command is a blocking gate. It publishes only the tarball that has
already passed automated and, by default, manual verification.

## Before starting

- Check out `main` and leave its worktree clean.
- Install dependencies and ensure npm authentication can publish
  `@barzhsieh/nuxt-content-mermaid`.
- Choose an exact SemVer greater than the version in `package.json`. The target
  must not already exist in npm.
- Do not create the release tag or change the package version by hand.

## Run a release

```bash
pnpm release 3.0.0
```

The gate runs `pnpm verify:source`, prepares version and changelog changes in an
isolated worktree, creates one local release commit, and packs exactly once. It
retains that tarball under `.release-evidence/3.0.0/`, verifies it through a
Clean Package User Consumer using actual-latest supported Nuxt 4 and Nuxt
Content versions, and then starts a second consumer for the manual checks.

Answer every manual prompt after checking the displayed consumer URL:

1. enter and exit fullscreen without losing the SVG or page state;
2. zoom, pan, and drag, then recover the viewport;
3. verify clipboard content and feedback;
4. verify controls and interactions in a narrow viewport; and
5. check labels, connectors, and controls for clipping, overlap, or runaway
   sizing.

A missing or failed answer stops the release. For a release that genuinely
does not need interaction verification, provide an explicit non-empty reason:

```bash
pnpm release 3.0.1 --skip-manual "documentation-only release"
```

After all gates pass, the command fast-forwards `main` to the prepared commit,
creates `v<version>`, atomically pushes `main` and the tag, and publishes the
retained tarball to `latest` with lifecycle scripts disabled. It revalidates
Git, the tag, package manifests, and tarball SHA-512 integrity before every
external effect.

## Evidence and failures

`.release-evidence/<version>/release.json` is a local journal, not an approval
token. It records source checks, the prepared commit, the exact resolved
compatibility profile, manual results or skip reason, status, timestamps, and
failure details. The retained tarball remains beside it. Both are gitignored.

If a failure occurs before push, fix the cause and start a fresh release. Never
reuse an unverified tarball or publish it manually.

If the atomic push succeeded but npm publish failed or returned an ambiguous
result, use the one narrow recovery command:

```bash
pnpm release reconcile 3.0.0
```

Reconciliation revalidates the local commit, tag, manifests, path, and retained
tarball integrity. It then queries the exact npm version:

- absent: publish the same retained tarball again;
- present with matching integrity: finish without republishing; or
- present with different integrity: stop with a fatal conflict.

Do not use reconciliation for failures that occurred before push. If the
registry result is still unknown, leave the evidence and tarball in place and
retry reconciliation later.
