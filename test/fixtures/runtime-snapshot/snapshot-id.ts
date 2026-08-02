const snapshotIds = new WeakMap<object, number>()
let nextSnapshotId = 0

export function identifySnapshot(snapshot: object): number {
  const existing = snapshotIds.get(snapshot)
  if (existing !== undefined) return existing

  nextSnapshotId += 1
  snapshotIds.set(snapshot, nextSnapshotId)
  return nextSnapshotId
}
