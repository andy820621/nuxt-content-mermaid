# Release workflow

The maintainer reviews the release PR and pushes one immutable annotated tag.
CI validates the source and package, publishes to npm, and creates the GitHub
Release.

## 1. Prepare the release PR

Start from the latest `main` and use a branch named for the version being
prepared:

```bash
version=3.0.3
branch="chore/prepare-release-v$version"

git switch main
git pull --ff-only origin main
git switch -c "$branch"
```

Run exactly one preparation script:

```bash
pnpm release:prepare:patch
# pnpm release:prepare:minor
# pnpm release:prepare:major
```

Review the generated version, lockfile, and changelog, then open the PR:

```bash
git diff -- package.json pnpm-lock.yaml CHANGELOG.md

git add -- package.json pnpm-lock.yaml CHANGELOG.md
git diff --cached --check
git commit -m "chore(release): prepare v$version"
git push -u origin "$branch"

gh pr create \
  --base main \
  --head "$branch" \
  --title "chore(release): prepare v$version" \
  --body "Prepare v$version package version and changelog."
```

Review the changelog, wait for every required check, and squash-merge the PR.
Do not commit `dist`, package archives, or other generated output.

## 2. Create the release tag

Update `main`, verify the release identity, then create and push an annotated
tag:

```bash
git switch main
git pull --ff-only origin main

version=3.0.3
release_commit=$(git rev-parse HEAD)

test "$(node -p "require('./package.json').version")" = "$version"
grep -Fxq "## v$version" CHANGELOG.md

git tag -a "v$version" "$release_commit" -m "v$version"
test "$(git cat-file -t "v$version")" = "tag"
test "$(git rev-list -n 1 "v$version")" = "$release_commit"
git push origin "refs/tags/v$version"
```

Never move or force-push a release tag.

## 3. Monitor and verify

The tag starts `.github/workflows/publish.yml`:

```bash
gh run list --workflow publish.yml --limit 1
gh run watch <run-id> --exit-status

npm view "@barzhsieh/nuxt-content-mermaid@$version" version dist-tags.latest --json
gh release view "v$version" --json tagName,isDraft,isPrerelease,url
```

If publication is ambiguous, query the exact npm version before retrying. If
npm succeeded but GitHub Release creation failed, run
`pnpm changelogen gh release "$version"`; never republish the npm version.
