# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- Create issues with `gh issue create`.
- Read issues and comments with `gh issue view <number> --comments`.
- Apply or remove labels with `gh issue edit`.
- Close issues with `gh issue close`.
- Infer the repository from the configured GitHub remote.

## Pull requests as a triage surface

PRs as a request surface: no.

## Publishing

When a skill says to publish to the issue tracker, create a GitHub issue. When a skill says to fetch a ticket, read the corresponding GitHub issue and its comments.

## Blocking work

Prefer GitHub native issue dependencies. If unavailable, record blockers explicitly in the issue body with a `Blocked by:` line.
