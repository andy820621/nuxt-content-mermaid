# Lean final compatibility profiles design

## Scope

Implement GitHub issue
[#61](https://github.com/andy820621/nuxt-content-mermaid/issues/61) as a
low-cost pre-publication safety net. Add two exact 3.x evidence profiles beside
the existing Representative Compatibility Matrix, without changing public
dependency metadata or removing any Nuxt 3 verification.

The two new profiles are:

| Profile | Node | Nuxt | Nuxt Content | Mermaid | Kit resolution | Schema resolution |
| --- | --- | --- | --- | --- | --- | --- |
| `v3-minimum` | `22.19.0` | `4.1.0` | `3.5.0` | `11.16.1` | `4.5.2` | `4.5.2` |
| `v3-known-latest` | `24.19.0` | `4.5.2` | `3.15.2` | `11.16.1` | `4.5.2` | `4.5.2` |

The known-latest values are fixed evidence, not dynamic registry lookups. Node
`24.19.0` is the exact Active LTS release selected for this baseline.

## Profile shape

Keep the existing `versions` dimensions and add one shallow field to the
profile:

```ts
interface VersionProfile {
  id: string
  nodeVersion: string
  versions: {
    betterSqlite3: string
    nuxt: string
    nuxtContent: string
    mermaid: string
    typescript: string
    vueTsc: string
  }
  expectedResolutions?: {
    nuxtKit: string
    nuxtSchema: string
  }
}
```

`expectedResolutions` is deliberately optional so the existing six profiles
and their evidence remain unchanged. It is a fixed assertion attached to a
profile, not a new combinable profile dimension and not the start of a generic
artifact-evidence model. Mermaid stays in `versions` because it is already a
Compatibility Profile dimension.

Both new profiles are ordinary entries in `VERSION_PROFILES` and remain
independently selectable through the existing `--profile <id>` interface. Do
not add a final-profile collection constant unless the CI implementation or a
focused test consumes it directly.

## Clean consumer and resolution proof

Reuse the existing actual-package-artifact pipeline and Clean Package User
Consumer. Each new profile must execute the current fixed stages:

1. clean install;
2. package exports and public types;
3. production build; and
4. browser-backed basic SVG rendering.

The generated consumer manifest continues to pin the existing profile
dimensions. For a profile with `expectedResolutions`, it also installs Schema
at the expected exact version and applies exact overrides only for Kit and
Schema, whose current pre-contract metadata does not coordinate the target
toolchain tuple. Mermaid remains the normal exact consumer dependency because
the current artifact range already admits `11.16.1`; its dependency-context
check below proves the artifact did not select another version. These overrides
exist solely for the expand step; they do not mutate the packed artifact or
public package metadata.

Resolution verification must follow dependency context rather than assume npm
hoisted the same package to the consumer root:

- resolve Mermaid and `@nuxt/kit` as dependencies of the installed
  `@barzhsieh/nuxt-content-mermaid` artifact;
- resolve `@nuxt/schema` from the installed Nuxt dependency context; and
- read and compare those resolved package manifests with the requested Mermaid
  version and the shallow `expectedResolutions` values.

Every resolved path must remain inside the clean consumer's `node_modules`.
This prevents a top-level package with the requested version from masking a
different version actually consumed by the artifact.

The install result and runner evidence retain requested and resolved Kit and
Schema values only when `expectedResolutions` is present. Existing profile
evidence does not gain empty or synthetic resolution records.

## CI orchestration

Keep `representative-compatibility-matrix` byte-for-byte equivalent in profile
membership and runtime declarations. Add a separate
`final-compatibility-profiles` job with two explicit include entries:

- `v3-minimum` under Node `22.19.0`;
- `v3-known-latest` under Node `24.19.0`.

Each entry uses `actions/setup-node` before dependency installation and invokes
the existing single-profile artifact verification command. The verifier's
Node-runtime preflight remains the fail-fast check that the observed process
matches the profile declaration.

## Failure behavior and tests

Profile parsing rejects missing, extra, ranged, or non-SemVer shallow
resolution values. Consumer installation fails when Mermaid, Kit, or Schema
resolves to an unexpected version or outside the clean consumer. The existing
runner then reports the failure at the install stage and skips later consumer
stages according to its current behavior.

Use TDD at four existing public seams:

- profile parsing and independent selection;
- clean-consumer manifest construction and dependency-context resolution;
- requested/resolved runner evidence;
- workflow orchestration and exact Node versions.

Focused tests must prove both final tuples are deterministic while the original
six-profile matrix and public package metadata stay unchanged. Run the relevant
Vitest files after each vertical slice, typecheck regularly, and run lint plus
the full test suite once before review and commit.

## Explicit non-goals

Do not add dynamic latest resolution, a scheduled canary, drift detection,
Release Baseline Freeze state, automated promotion, or a compatibility
governance framework. Do not alter dependency ranges, repository development
catalogs, Nuxt compatibility metadata, the existing matrix, or Nuxt 3 profiles.
Further automation requires evidence from real user issues or repeated
maintenance pain.
