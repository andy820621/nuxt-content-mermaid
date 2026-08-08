export const VERSION_PROFILES = Object.freeze({
  'nuxt-4-known-latest': Object.freeze({
    id: 'nuxt-4-known-latest',
    versions: Object.freeze({
      betterSqlite3: '12.11.1',
      nuxt: '4.5.2',
      nuxtContent: '3.15.2',
      mermaid: '11.12.3',
      typescript: '5.9.3',
      vueTsc: '3.2.5',
    }),
  }),
})

export function selectVersionProfile(profileId) {
  const profile = VERSION_PROFILES[profileId]
  if (!profile) throw new Error(`Unknown Version Profile: ${profileId}`)
  return profile
}
