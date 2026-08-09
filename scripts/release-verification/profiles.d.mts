import type { VersionProfile } from './runner.mjs'

export const VERSION_PROFILES: Readonly<Record<string, Readonly<VersionProfile>>>
export const PINNED_MATRIX_PROFILE_IDS: readonly string[]
export function parseVersionProfile(input: unknown): Readonly<VersionProfile>
export function selectVersionProfile(profileId: string): Readonly<VersionProfile>
export function expandVersionProfiles(selection: {
  profileId?: string
  matrixId?: string
}): readonly Readonly<VersionProfile>[]
