# 3.x Dependency Version Strategy

## Context

nuxt-content-mermaid integrates Nuxt Content with Mermaid and is maintained by one person for a package with roughly 400 weekly downloads. Version policy must keep the current release compatible with the active Nuxt and Nuxt Content lines without creating a governance system that costs more to maintain than the package itself.

The policy therefore separates the public Compatibility Contract from fixed compatibility evidence. Published ranges remain prospective semver promises, while exact profiles record the combinations that were deliberately verified. Maintenance is best effort: the project provides no detection, response, or repair service-level agreement.

## Goals

- Keep the current 3.x release able to follow the latest stable Nuxt Content 3 release on Nuxt 4.
- Own the package's Nuxt and Nuxt Content Compatibility Contract instead of copying upstream metadata mechanically.
- Preserve already published ranges as prospective promises rather than reinterpreting them after an upstream release.
- Give releases reproducible minimum and known-latest artifact evidence.
- Keep Mermaid security and compatibility updates sustainable for an individual maintainer.
- Scale automation and ongoing maintenance to demonstrated package usage and risk.

## Non-goals

- No exhaustive Cartesian version matrix.
- No automatic promotion state machine, compatibility issue creation, release, or merge.
- No weekly drift, incident-response, or repair SLA.
- No complete upstream security-version database.
- No guarantee for exact Mermaid SVG serialization, layout, undocumented DOM, or every Mermaid diagram feature.
- No parallel feature or ordinary bug-fix maintenance for the 2.x line after 3.0 ships.

## Public Dependency Contract

The initial 3.0 target is:

```json
{
  "engines": {
    "node": ">=22.19.0"
  },
  "peerDependencies": {
    "nuxt": "^4.1.0",
    "@nuxt/content": ">=3.5.0 <4.0.0"
  },
  "dependencies": {
    "@nuxt/kit": "^4.5.2",
    "mermaid": "~11.17.0"
  }
}
```

`@nuxt/schema` is a development and type-contract dependency coordinated with the Known-Latest Nuxt baseline, initially `4.5.2`. If the Known-Latest Nuxt Toolchain Family or Mermaid changes before the Release Baseline Freeze, the lower bounds use the versions that pass the final fixed-profile verification.

Nuxt and Nuxt Content are Package User-owned host dependencies. Every non-prerelease release satisfying their published peer ranges is a Declared-Compatible Combination, including future minor and patch releases within those majors. A new upstream major is outside the contract until this package explicitly verifies and adds it. Nuxt module compatibility metadata and package peer metadata must describe the same Supported Nuxt Range.

Node is a profile dimension but not an independent substitute for upstream engine requirements. The effective Node range is the intersection of this package's engine, the selected Nuxt version, and the selected Nuxt Content version. The package does not reproduce conditional per-Nuxt Node ranges in its metadata and verifies only representative maintained Node combinations.

Mermaid is a Module-Owned Dependency. Its tilde range permits future patches within the selected minor to enter fresh installs under a limited semver presumption, including security fixes, but prevents an unreviewed new minor or major from entering. `@nuxt/kit` is a Nuxt Toolchain Family dependency: its Nuxt 4 caret supports forward host integration, while the lockfile and artifact evidence record the exact version resolved during verification.

The 3.0 Minimum Compatibility Profile must pass before these floors become final. If it fails, investigation identifies the responsible boundary and raises only that floor to the earliest version that satisfies the contract; it does not jump every dependency to Known-Latest automatically.

## Package-Owned Integration Behavior

The Compatibility Contract covers behavior owned by nuxt-content-mermaid at its integration seams:

- when the bundled Mermaid engine successfully renders diagram source, the Built-in Renderer commits the resulting usable SVG according to the transactional rendering contract; when Mermaid fails, package-owned error and fallback semantics apply;
- Nuxt and Content activation, Markdown transformation, configuration transport, and public types behave as documented;
- theme, toolbar, lazy rendering, error fallback, transactional rendering, and documented extension or styling hooks preserve their package-owned semantics.

The contract does not cover byte-identical SVG, exact element order, undocumented classes or generated identifiers, node coordinates, dimensions, font measurement, layout, Mermaid internals, or exhaustive correctness of every Mermaid diagram type. Package Users that need a stable visual snapshot must retain their own dependency lockfile and control the browser version, fonts, viewport, and relevant execution environment rather than treating Mermaid's exact output as this package's public contract.

## Compatibility Evidence

### Minimum Compatibility Profile

The Minimum Compatibility Profile fixes exact versions at the public Nuxt and Nuxt Content floors, the package Node floor, the frozen Mermaid version, and the Nuxt Toolchain Family resolved for the release. It proves the lower boundary without claiming that only this combination is supported.

### Known-Latest Compatibility Profile

The Known-Latest Compatibility Profile is one atomic exact tuple of Node, Nuxt, Nuxt Content, and Mermaid. A normal dependency update changes one primary dimension at a time, holds the other dimensions fixed, and verifies the complete tuple. Kit and Schema move with the Nuxt dimension and their exact resolutions remain artifact evidence rather than public profile dimensions.

Known-Latest Versions are evidence baselines, not peer-range ceilings. Updating only repository pins, the lockfile, or fixed evidence without changing the publishable artifact or runtime code does not require an npm release.

### Fixed 3.x Compatibility Profiles

The 3.x Compatibility Contract retains two fixed profiles that verify the
Publishable Package Artifact through clean installation, public types, production build,
and basic browser SVG rendering:

| Profile | Node | Nuxt | Nuxt Content | Mermaid | Kit resolution | Schema resolution |
| --- | --- | --- | --- | --- | --- | --- |
| `v3-minimum` | `22.19.0` | `4.1.0` | `3.5.0` | `11.17.0` | `4.5.2` | `4.5.2` |
| `v3-known-latest` | `24.19.0` | `4.5.2` | `3.15.2` | `11.17.0` | `4.5.2` | `4.5.2` |

Each profile runs under its exact declared Node runtime. Kit and Schema remain
one shallow pair of expected artifact resolutions rather than additional
Compatibility Profile dimensions. Verification resolves Mermaid and Kit from
the installed Publishable Package Artifact's dependency context and Schema from
Nuxt's dependency context, so matching top-level dependencies in the Package
User application cannot mask a different version used by the Publishable
Package Artifact. Verification may apply exact Kit and Schema overrides to the
clean Package User application without changing published metadata.

These profiles are fixed release evidence. They do not introduce dynamic latest
resolution, a scheduled canary, or drift automation.

## Release Baseline Freeze

The Release Baseline is the immutable tuple of the verified `main` commit, its
annotated stable version tag, the target version, the Publishable Package
Artifact identity, and the two fixed Compatibility Profiles.
`docs/specs/release-verification.md` defines the authoritative tag-driven
Publish workflow gates.

Before tagging, PR CI verifies the merge candidate with both the Minimum and
Known-Latest profiles under their exact declared Node runtimes. The maintainer
then creates an annotated tag on the verified `main` commit. The tag workflow
packs exactly one Publishable Package Artifact, records its SHA-256 identity,
verifies it under the Known-Latest profile, and publishes that same local
archive without repacking or cross-job transport.

The frozen baseline includes:

- the tagged `main` commit and target stable version;
- the Publishable Package Artifact name, version, filename, and SHA-256;
- the complete fixed Minimum and Known-Latest Compatibility Profiles; and
- the artifact manifest's shallow Node, Nuxt, Nuxt Content, Kit, and Mermaid
  version contract.

Both CI profiles run public exports, public types, production build, and basic
browser SVG rendering. A failure in either profile blocks merge. The tag
workflow repeats only the Package User-facing verification needed to establish the
identity and health of the actual publishable tarball. npm publication is the
only registry mutation, and the GitHub Release is created after it succeeds.

Ordinary upstream releases discovered after the freeze wait for a later package
release. Any source, release metadata, manifest range, Version Profile, or
artifact change requires a new ordinary PR baseline and a new version tag.
The freeze is a release-candidate cutoff, not a support ceiling or long-lived
dependency freeze.

## Proportionate Verification

General pull requests run the shared lint, unit, source type, and current fixed primary integration checks. Dependency bot pull requests update fixed versions and the lockfile for maintainer review; they are not automatically merged or published.

Before merge, the candidate commit must pass both the Minimum and Known-Latest
Compatibility Profiles. Each profile covers clean installation, public package
types, production build, and basic browser SVG rendering. After tagging, the
single actual Publishable Package Artifact repeats this Package User-facing gate
under Known-Latest before npm publication. Together, the two fixed profiles and
the retained artifact identity form the complete automated release evidence.

New dependency majors and new Mermaid minors are handled by dependency bot or
maintainer pull requests before a later freeze, never through dynamic latest
resolution in the release command.

## Contract Gaps

A workflow failure or user report becomes a Contract Gap only after a maintainer reproduces a Declared-Compatible Combination in a clean environment with exact versions and confirms a failure of installation, public types, production build, or Package-Owned Integration Behavior. Infrastructure failures and versions outside published ranges are not Contract Gaps.

Confirmed gaps in the Active Support Line take priority over ordinary feature work, without a response or repair SLA. When preparing an ordinary release, the maintainer first fixes or explicitly resolves a known gap. The preferred correction preserves the existing Compatibility Contract and ships as a patch.

If an in-range upstream change cannot be worked around, the maintainer reports it upstream, records the failing and known-working versions, and recommends a temporary Package User pin. If upstream will not restore compatibility or waiting is no longer viable, a new package major may raise a floor, exclude a version, or narrow a peer range. A patch must not silently rewrite the old contract.

A critical security release may proceed while a disclosed Contract Gap remains, but it must pass package artifact verification against known-working profiles and explain the temporary version recommendation in its release notes.

## Security Boundary

Compatibility means the integration is expected to operate; it does not certify that every old compatible upstream release remains secure or recommended for production. Documentation should recommend upstream-maintained, patched versions without turning that recommendation into the peer floor.

Nuxt and Nuxt Content are Package User-owned peers, so ordinary upstream advisories remain the responsibility of the application's lockfile, Dependabot, and security tooling. This package publishes targeted guidance or a correction when its own feature path necessarily exposes the vulnerability or requires a package change to mitigate it.

For Mermaid, Kit, or another direct dependency, a fixed upstream security correction raises the dependency range lower bound and ships in a package patch when Package-Owned Integration Behavior remains compatible. If safe use requires raising the Nuxt, Nuxt Content, or Node floor, the narrowed contract requires a package major. Security urgency never skips the relevant package artifact verification.

## Package Semver

Package semver follows the highest Package User-visible impact in a release:

| Change | Package release |
| --- | --- |
| Dev pin, lockfile, or evidence-only update | No npm release |
| Restore a Declared-Compatible Combination | Patch |
| Compatible or security update to a Module-Owned Dependency | Patch |
| Add a public capability or preserve old ranges while adding an upstream major | Minor |
| Lower a minimum supported version | Minor |
| Raise a Nuxt, Nuxt Content, or Node floor | Major |
| Remove a peer major, narrow a peer range, or change dependency ownership | Major |
| Require Package User migration | Major |

A Mermaid release number does not mechanically dictate this package's bump. A compatible engine or security update is normally a patch, an intentionally exposed capability is a minor, and a required migration of existing package-owned behavior is a major.

## 2.x Frozen Policy

When 3.0 publishes, 2.x becomes a Frozen Legacy Release for Nuxt 3. Existing npm versions remain installable and are not automatically deprecated, but the line receives no dependency updates, compatibility expansion, new features, or ordinary fixes.

The first three months after 3.0 form a Migration Assistance Window for documentation, usage guidance, and 3.x defects that prevent migration. A low-risk backport for a package-caused critical security issue may be considered individually without reopening ordinary 2.x maintenance. Evidence of substantial Nuxt 3 demand may justify extending assistance, but no extension is promised in advance.

## Release Acceptance

A 3.x release is eligible for publication only when:

- its manifest and Nuxt compatibility metadata express the approved ranges;
- its Package-Owned Integration Behavior remains within the documented boundary;
- the Release Baseline Freeze identifies exact Minimum and Known-Latest Compatibility Profiles;
- the candidate commit passes both profiles and the tagged publishable artifact passes Known-Latest verification;
- known Contract Gaps are fixed or, for a critical security exception, explicitly disclosed with a known-working recommendation;
- the release bump matches the highest Package User-visible contract change.
