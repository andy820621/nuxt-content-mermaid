# Domain Docs

This repository uses a single-context domain documentation layout.

## Before exploring

Read the root `CONTEXT.md` and relevant records under `docs/adr/`. If either location does not exist, proceed without creating it; `/domain-modeling` creates domain records lazily as terms and decisions are resolved.

## Vocabulary

Use the canonical terms defined in `CONTEXT.md` in issues, specs, refactor proposals, hypotheses, and tests. Do not substitute terms listed under `_Avoid_`.

## ADRs

Respect relevant ADRs. If proposed work contradicts one, surface the conflict explicitly instead of silently overriding it.

## Specifications

Use `docs/specs/` for durable, integrated architecture and product contracts that span multiple ADRs. Specifications describe the accepted system boundary and verification scope; ADRs remain the source of individual decisions and rationale.

Execution plans, blocking edges, and implementation progress belong in the configured issue tracker. Do not add workflow-specific plan directories or task checklists to the permanent documentation tree.
