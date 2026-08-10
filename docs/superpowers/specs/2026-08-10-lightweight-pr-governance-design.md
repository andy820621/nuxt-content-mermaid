# Lightweight Pull Request Governance Design

## Goal

Make AI-generated and human-written pull requests converge on a predictable
format without adding dependencies or creating unnecessary friction for
contributors.

The repository will guide authors at generation time, structure pull request
descriptions at authoring time, and validate pull request titles in CI. GitHub
repository rules will remain an explicit maintainer-controlled rollout step.

## Mental Model

The three layers have distinct responsibilities:

1. Copilot instructions improve generated content but do not enforce it.
2. The pull request template makes the expected description structure visible.
3. The title workflow is the executable contract for Conventional Commit-style
   pull request titles.

This separation keeps prose guidance flexible while making the one rule that
drives squash-merge history mechanically verifiable.

## Copilot Instructions

Create `.github/copilot-instructions.md` with repository-wide Git conventions.
It will instruct AI tools to:

- generate commit messages and pull request titles using Conventional Commits;
- use `<type>(<optional-scope>): <description>`;
- use one of the title types accepted by the validation workflow;
- represent dependency updates as `chore(deps): <description>` rather than a
  custom `deps` type;
- keep descriptions concise, imperative, and without a trailing period;
- follow the pull request template;
- explain why a change is needed, not only how it is implemented; and
- include related Issue/discussion links; and
- report each validation actually performed with its command and outcome.

The instructions improve supported Copilot and agent workflows. They do not
claim to control GitHub.com's commit-message generator.

## Pull Request Template

Create `.github/PULL_REQUEST_TEMPLATE.md` with these sections:

- `Summary`: a concise explanation of the purpose and outcome, with related
  Issue/discussion links;
- `Changes`: the important implementation or documentation changes;
- `Validation`: each test, build, lint, or manual check actually performed,
  with its command and outcome;
- `Notes` (optional): migrations, limitations, screenshots, or follow-up work.

Each section will contain an HTML comment describing what belongs there. The
comments guide authors without appearing in the rendered pull request body.

## Pull Request Title Contract

Create `.github/workflows/validate-pr-title.yml` for pull request events that
can change the title or restore a pull request to active review. The workflow
will use a shell condition only. It will not install a package, invoke a
third-party action, or check out repository contents.

Accepted titles use this grammar:

```text
<type>(<optional-scope>): <description>
```

Accepted types are:

```text
feat|fix|refactor|test|docs|chore|build|ci|perf|revert
```

The scope is optional. When present, it must be non-empty, enclosed in
parentheses, and contain no parentheses or colon. The description must contain
at least one non-whitespace character. Dependency changes use
`chore(deps): <description>`.

The first version deliberately does not add extra policy for description case,
length, or punctuation. Those concerns remain generation guidance rather than
CI blockers.

On failure, the workflow will print the accepted grammar, the type list, and
valid examples with and without a scope.

## Rollout and Merge Strategy

The workflow will report failures as a normal GitHub check, but this repository
change will not make it a required check. After maintainers observe real pull
requests long enough to confirm that the rule has no material false positives,
they may add the check to a GitHub ruleset.

The recommended repository strategy is squash merging with the pull request
title used as the final commit title. This makes title validation directly
protect the permanent Git history and gives the three-layer approach its
highest return on maintenance cost.

Rulesets, allowed merge methods, and the squash commit message default are
GitHub repository-level settings. They are intentionally outside this
version-controlled change and remain a maintainer action.

## Failure Handling and Security

The title will be passed to the shell through an environment variable rather
than interpolated into the script source. This prevents pull request text from
being interpreted as shell syntax.

The workflow needs only the default read-only access required to evaluate event
metadata. It will declare `contents: read` and will not check out repository
contents, write to the repository, or consume secrets.

## Verification

Verification will cover:

- valid titles with and without a scope;
- `chore(deps): ...` as the supported dependency-update form;
- rejection of an unsupported `deps: ...` type;
- rejection of missing descriptions, malformed scopes, and unsupported types;
- YAML parsing and repository linting; and
- a review of workflow permissions and interpolation boundaries.

The workflow's regular expression will be exercised locally against a table of
accepted and rejected titles before the repository-wide validation commands
are run.

## Non-Goals

- Enforcing every intermediate commit message.
- Controlling GitHub.com's commit-message generation button.
- Adding commitlint, semantic-pull-request, or another dependency.
- Automatically modifying GitHub rulesets or merge settings.
- Making the title check required during the initial rollout.
