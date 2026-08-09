const EXACT_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9a-z-]+(?:\.[0-9a-z-]+)*))?(?:\+([0-9a-z-]+(?:\.[0-9a-z-]+)*))?$/i

export function parseExactSemver(value) {
  const match = typeof value === 'string'
    ? EXACT_SEMVER_PATTERN.exec(value)
    : null
  const prerelease = match?.[4]?.split('.') ?? []
  if (!match || prerelease.some(identifier => /^\d+$/.test(identifier) && /^0\d+/.test(identifier))) {
    return null
  }
  return match
}
