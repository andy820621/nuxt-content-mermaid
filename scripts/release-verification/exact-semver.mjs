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

export function parseStableSemver(value) {
  const parsed = parseExactSemver(value)
  return parsed && !parsed[4] && !parsed[5] ? parsed : null
}

export function compareStableSemver(left, right) {
  const leftVersion = parseStableSemver(left)
  const rightVersion = parseStableSemver(right)
  if (!leftVersion || !rightVersion) {
    throw new Error('Version comparison requires two stable exact versions')
  }
  for (let index = 1; index <= 3; index += 1) {
    const difference = Number(leftVersion[index]) - Number(rightVersion[index])
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}
