import { computed } from 'vue'
import { useMounted } from './useMounted'

/* @__NO_SIDE_EFFECTS__ */
export function useSupported(callback: () => unknown) {
  const isMounted = useMounted()

  return computed(() => {
    if (!isMounted.value) return false
    return Boolean(callback())
  })
}

export type UseSupportedReturn = ReturnType<typeof useSupported>
