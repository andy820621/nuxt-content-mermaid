import type { VersionProfile } from './runner.mjs'

export const VERSION_PROFILES: Readonly<Record<string, Readonly<VersionProfile>>>
export function selectVersionProfile(profileId: string): Readonly<VersionProfile>
