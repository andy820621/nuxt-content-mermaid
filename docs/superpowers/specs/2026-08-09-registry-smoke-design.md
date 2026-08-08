# Registry smoke design

## Purpose and boundaries

After a package has been published to npm with the `latest` dist-tag, the
release flow must prove that the exact published version works for a clean
package user. This is a small post-publication health check, not another
release platform or compatibility matrix.

The check accepts one exact SemVer package version. It installs only
`@barzhsieh/nuxt-content-mermaid@<version>` from the npm registry. Workspace,
tarball, source, and dist-tag fallback inputs are invalid.

The existing Clean Package User Consumer template, consumer verification
operations, and actual-latest Nuxt 4 Version Profile remain the only consumer
seam. Registry smoke covers only clean install, production build, production
startup, and a visible non-empty Mermaid SVG. It does not repeat archive,
exports, types, or the full compatibility matrix.

## Shared verification core

The runner will keep one shared consumer-verification core as an internal seam.
Callers do not receive a stage-list interface. Instead, the artifact and
registry orchestrators each choose a fixed, named verification plan: the
artifact plan remains the existing full flow, and the registry plan is exactly
`install`, `build`, and `runtime`. The registry install operation checks the
resolved installed manifest before the remaining stages execute.

This keeps the observable consumer contract in one place: both modes create a
new workspace from the same template, resolve the same Version Profile, build
the same production consumer, start it, and require the existing real SVG
assertion. Registry orchestration owns only registry-source validation,
registry-specific evidence, and retry classification.

## Frozen profile and evidence

The first registry smoke resolves the actual-latest Version Profile once and
records both the requested ranges and exact resolved versions in release
evidence. A retry receives that recorded profile as input and must not resolve
new latest versions. This makes a retry an independent clean reproduction of
the same package and dependency selection rather than a different test.

Evidence records publication and registry health separately without changing
the existing publication evidence contract:

- the existing top-level `status: 'published'` continues to describe whether
  the exact package was published; and
- an additive `registryHealth.status` describes `pending`, `healthy`,
  `investigation`, or `unhealthy` for the exact package version and frozen
  profile. Its attempts retain the stage, classification, and frozen profile
  evidence required for a later retry.

Publication remains successful if a post-publication registry smoke first
fails. The first failure stores its stage and a retry command, then marks
registry health as `investigation`; it does not deprecate anything. The retry
classifies registry, network, runner, and permission failures as
infrastructure investigation. Evidence created before this change remains
readable when it has no `registryHealth` field.

A retry accepts only the exact target version and evidence location. It finds
the initial `investigation` attempt itself, then validates its requested and
resolved package version, release identity, and complete frozen profile before
creating a new clean consumer. It exposes no profile override option. A retry
is `unhealthy` only when the version, frozen resolved Version Profile,
package-defect classification, package-user failure stage, and independent
clean-consumer condition all match the initial attempt. Repeated failures at
the same stage alone do not establish a package defect.

## Release integration and recovery

The existing release flow calls registry smoke only after publishing the exact
tarball to `latest`, then updates the existing evidence file. A dedicated
retry path invokes the same registry orchestration by reading the recorded
version and frozen profile from evidence. Neither path publishes, repacks,
promotes a tag, or makes any external recovery decision.

The release guide will add a concise recovery runbook: investigate the first
failure; run an independent clean retry; identify infrastructure versus package
defect; and, only for a confirmed unhealthy package, manually deprecate the
exact version with a message pointing to a usable or forthcoming fixed version.
It will instruct maintainers to prepare and verify a corrective patch and will
explicitly prohibit unpublishing.

## Automated coverage

Focused tests use injected command and consumer operations; they never publish
or deprecate a real package. They cover exact-version rejection, registry-only
installation, resolved-version mismatch, fixed registry plan, frozen
evidence-derived retry profiles, additive evidence compatibility, orthogonal
publication and health statuses, first-failure investigation, and confirmed
package-defect classification.

## Out of scope

This change does not add a release service, database, candidate dist-tag,
automatic promotion, automatic deprecation, automatic patch publication, or a
rollback platform.
