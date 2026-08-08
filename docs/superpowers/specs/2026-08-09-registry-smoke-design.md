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

The runner will expose one consumer-verification core parameterized by a
package source and an explicit stage list. The existing package-artifact flow
will keep its current stage selection. Registry smoke will select only
`install`, `build`, and `runtime`, while the registry install operation checks
the resolved installed manifest before the remaining stages execute.

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

Evidence records publication and registry health separately:

- `publication.status` describes whether the exact package was published.
- `registryHealth.status` describes `pending`, `healthy`, `investigation`, or
  `unhealthy` for the exact package version and frozen profile.

Publication remains successful if a post-publication registry smoke first
fails. The first failure stores its stage and a retry command, then marks
registry health as `investigation`; it does not deprecate anything. The retry
classifies registry, network, runner, and permission failures as
infrastructure investigation. Only a repeated package-user failure at the
same stage and the frozen profile becomes `unhealthy`.

## Release integration and recovery

The existing release flow calls registry smoke only after publishing the exact
tarball to `latest`, then updates the existing evidence file. A dedicated
retry path invokes the same registry orchestration with the recorded version
and frozen profile. Neither path publishes, repacks, promotes a tag, or makes
any external recovery decision.

The release guide will add a concise recovery runbook: investigate the first
failure; run an independent clean retry; identify infrastructure versus package
defect; and, only for a confirmed unhealthy package, manually deprecate the
exact version with a message pointing to a usable or forthcoming fixed version.
It will instruct maintainers to prepare and verify a corrective patch and will
explicitly prohibit unpublishing.

## Automated coverage

Focused tests use injected command and consumer operations; they never publish
or deprecate a real package. They cover exact-version rejection, registry-only
installation, resolved-version mismatch, restricted smoke stages, frozen retry
profiles, orthogonal evidence statuses, first-failure investigation, and
confirmed package-defect classification.

## Out of scope

This change does not add a release service, database, candidate dist-tag,
automatic promotion, automatic deprecation, automatic patch publication, or a
rollback platform.
