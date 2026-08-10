# Lightweight Pull Request Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dependency-free repository guidance, a pull request template, and a CI check that keeps squash-merge titles compatible with Conventional Commits.

**Architecture:** Generation guidance, authoring structure, and enforcement remain separate. `.github/copilot-instructions.md` guides supported AI tools, `.github/PULL_REQUEST_TEMPLATE.md` structures human-visible input, and an isolated GitHub Actions workflow validates the untrusted pull request title through an environment variable and Bash ERE without checking out code or installing packages.

**Tech Stack:** Markdown, GitHub Actions YAML, Bash ERE, pnpm, existing ESLint/Vitest/Vue TypeScript verification.

## Global Constraints

- PR titles accept both `<type>: <description>` and `<type>(<scope>): <description>`.
- Allowed types are exactly `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, and `revert`.
- Dependency updates use `chore(deps): <description>`; `deps` is not a type.
- Scope is optional. When present, it is non-empty and contains no `(`, `)`, or `:`.
- Description contains at least one non-whitespace character.
- Description case, length, and punctuation are guidance, not CI blockers.
- `Notes` is the only optional pull request template section.
- The title workflow installs no package, invokes no action, checks out no repository content, and consumes no secret.
- The workflow reports failures but this change does not make the check required or mutate GitHub rulesets and merge settings.
- Preserve all unrelated user changes.

---

## File Structure

- `.github/copilot-instructions.md`: generation-time commit and pull request conventions for supported AI tools.
- `.github/PULL_REQUEST_TEMPLATE.md`: authoring-time pull request description structure.
- `.github/workflows/validate-pr-title.yml`: dependency-free executable pull request title contract.
- `docs/superpowers/plans/2026-08-10-lightweight-pr-governance.md`: implementation checklist and verification record.

### Task 1: Record the work and add authoring guidance

**Files:**
- Create: `.github/copilot-instructions.md`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Include when committing: `docs/superpowers/plans/2026-08-10-lightweight-pr-governance.md`

**Interfaces:**
- Consumes: the accepted title grammar and repository Conventional Commits convention.
- Produces: generation guidance and a four-section pull request description contract used by contributors and supported AI tools.

- [ ] **Step 1: Create the GitHub implementation issue**

Run:

```bash
gh issue create \
  --title "Add lightweight pull request governance" \
  --body "$(printf '%s\n' \
    '## Summary' \
    '' \
    'Add repository guidance, a pull request template, and dependency-free PR title validation for the squash-merge workflow.' \
    '' \
    '## Acceptance criteria' \
    '' \
    '- Copilot instructions describe the repository Git and PR conventions.' \
    '- The PR template contains Summary, Changes, Validation, and optional Notes sections, with related Issue/discussion links and validation commands and outcomes.' \
    '- PR titles accept the approved Conventional Commit types with an optional scope.' \
    '- Dependency updates use chore(deps), not a deps type.' \
    '- Validation installs no package and is not made a required check by this change.')"
```

Expected: GitHub returns the URL of one new issue in the configured repository.

- [ ] **Step 2: Confirm that the guidance files are initially absent**

Run:

```bash
test ! -e .github/copilot-instructions.md
test ! -e .github/PULL_REQUEST_TEMPLATE.md
```

Expected: both commands exit 0. If either file exists, stop and reconcile its content rather than overwriting it.

- [ ] **Step 3: Create the Copilot instructions**

Create `.github/copilot-instructions.md` with exactly this content:

```markdown
# Repository custom instructions

## Git conventions

When generating commit messages or pull request titles:

- Follow Conventional Commits.
- Use `<type>(<optional-scope>): <description>`.
- Use one of these types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`,
  `build`, `ci`, `perf`, or `revert`.
- Use `chore(deps): <description>` for dependency updates; do not use `deps` as
  a type.
- Keep the description concise and imperative, and do not end it with a period.
- Add a commit body only when it provides context that is not clear from the
  title.

When creating pull requests:

- Use a Conventional Commit-compatible pull request title.
- Follow the repository pull request template.
- Explain the reason for the change and its outcome, not only the implementation.
- Include related Issue/discussion links.
- For each validation actually performed, include its command and outcome.
- Do not claim a test, build, lint, or manual check passed unless it was run.
```

- [ ] **Step 4: Create the pull request template**

Create `.github/PULL_REQUEST_TEMPLATE.md` with exactly this content:

```markdown
## Summary

<!-- Briefly explain why this change is needed and its outcome. Include related Issue/discussion links. -->

## Changes

<!-- List the important implementation or documentation changes. -->

## Validation

<!-- List each test, build, lint, or manual check actually performed, with its command and outcome. -->

## Notes (optional)

<!-- Add migrations, limitations, screenshots, or follow-up work. Remove this section when it is not needed. -->
```

- [ ] **Step 5: Verify the authoring contract**

Run:

```bash
rg -n '^## Git conventions$|chore\(deps\)|related Issue/discussion|command and outcome|Do not claim' .github/copilot-instructions.md
rg -n '^## (Summary|Changes|Validation|Notes \(optional\))$' .github/PULL_REQUEST_TEMPLATE.md
```

Expected: the first command reports all five guidance concepts; the second reports exactly four headings.

- [ ] **Step 6: Commit the guidance and plan**

```bash
git add \
  .github/copilot-instructions.md \
  .github/PULL_REQUEST_TEMPLATE.md \
  docs/superpowers/plans/2026-08-10-lightweight-pr-governance.md
git commit -m "docs: add pull request authoring guidance"
```

### Task 2: Add and verify dependency-free title validation

**Files:**
- Create: `.github/workflows/validate-pr-title.yml`

**Interfaces:**
- Consumes: `github.event.pull_request.title` from GitHub Actions event metadata.
- Produces: the `Conventional PR title` check, which succeeds only when the title matches the accepted grammar.

- [ ] **Step 1: Confirm that the workflow is initially absent**

Run:

```bash
test ! -e .github/workflows/validate-pr-title.yml
```

Expected: exit 0. If the file exists, stop and reconcile its content rather than overwriting it.

- [ ] **Step 2: Create the validation workflow**

Create `.github/workflows/validate-pr-title.yml` with exactly this content:

```yaml
name: Validate PR title

on:
  pull_request:
    branches:
      - main
    types:
      - opened
      - edited
      - synchronize
      - reopened
      - ready_for_review

permissions:
  contents: read

jobs:
  validate-title:
    name: Conventional PR title
    runs-on: ubuntu-latest

    steps:
      - name: Validate title
        env:
          PR_TITLE: ${{ github.event.pull_request.title }}
        shell: bash
        run: |
          title_pattern='^(feat|fix|refactor|test|docs|chore|build|ci|perf|revert)(\([^():]+\))?: .*[[:graph:]].*$'

          if [[ "$PR_TITLE" =~ $title_pattern ]]; then
            exit 0
          fi

          echo "Invalid pull request title: $PR_TITLE"
          echo "Expected: <type>: <description> or <type>(<scope>): <description>"
          echo "Types: feat, fix, refactor, test, docs, chore, build, ci, perf, revert"
          echo "Examples: feat: add toolbar | fix(rendering): preserve last diagram | chore(deps): update mermaid"
          exit 1
```

- [ ] **Step 3: Exercise the title grammar with accepted and rejected tables**

Run:

```bash
bash -c '
title_pattern='"'"'^(feat|fix|refactor|test|docs|chore|build|ci|perf|revert)(\([^():]+\))?: .*[[:graph:]].*$'"'"'
valid=(
  "feat: add toolbar"
  "fix(rendering): preserve last diagram"
  "chore(deps): update mermaid"
)
invalid=(
  "deps: update mermaid"
  "feat: "
  "feat:    "
  "feat(): add toolbar"
  "feat(ui:toolbar): add toolbar"
  "Feat: add toolbar"
  "feat:add toolbar"
)

for title in "${valid[@]}"; do
  [[ "$title" =~ $title_pattern ]] || {
    echo "unexpected invalid title: $title"
    exit 1
  }
done

for title in "${invalid[@]}"; do
  [[ ! "$title" =~ $title_pattern ]] || {
    echo "unexpected valid title: $title"
    exit 1
  }
done
'
```

Expected: exit 0 with no output.

- [ ] **Step 4: Parse the workflow and inspect its security boundary**

Run:

```bash
ruby -e 'require "yaml"; YAML.safe_load(File.read(".github/workflows/validate-pr-title.yml"), [], [], true)'
! rg -n 'uses:|checkout|secrets\.' .github/workflows/validate-pr-title.yml
rg -n '^permissions:|^  contents: read$|PR_TITLE:.*github\.event\.pull_request\.title' .github/workflows/validate-pr-title.yml
```

Expected: YAML parsing succeeds, the forbidden integration count is zero, and the final command reports explicit read-only permission plus environment-variable transport.

- [ ] **Step 5: Run the repository-required verification**

Run:

```bash
pnpm lint --fix
pnpm test
pnpm test:types
git diff --check
```

Expected: every command exits 0. Inspect `git status --short`; if lint changed a task-owned file, include that correction in this task. Do not stage unrelated user changes.

- [ ] **Step 6: Commit the workflow**

```bash
git add .github/workflows/validate-pr-title.yml
git commit -m "ci: validate conventional PR titles"
```

- [ ] **Step 7: Verify the branch deliverable**

Run:

```bash
git status --short
git log --oneline main..HEAD
git diff --check main...HEAD
git diff --stat main...HEAD
```

Expected: the working tree is clean; the branch contains the design, guidance, and workflow commits; the diff has no whitespace errors; and only the accepted documentation and `.github` files changed.
