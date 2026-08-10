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
