import type { Ref } from 'vue'

type WebsiteColorMode = 'light' | 'dark'
const themeTransitionDuration = 400

type ThemeViewTransition = {
  finished: Promise<void>
  ready: Promise<void>
}

type ThemeDocument = Document & {
  startViewTransition?: (callback: () => void) => ThemeViewTransition
}

export interface WebsiteThemeController {
  activeTheme: Readonly<Ref<WebsiteColorMode>>
  isTransitioning: Readonly<Ref<boolean>>
  toggle: (event?: MouseEvent) => Promise<void>
}

export function useWebsiteTheme(): WebsiteThemeController {
  const colorMode = useColorMode()
  const isTransitioning = ref(false)
  const activeTheme = computed<WebsiteColorMode>(() =>
    colorMode.value === 'dark' ? 'dark' : 'light',
  )

  function applyNextTheme() {
    colorMode.preference = activeTheme.value === 'dark' ? 'light' : 'dark'
  }

  async function toggle(event?: MouseEvent) {
    if (isTransitioning.value)
      return

    const documentWithTransition = document as ThemeDocument
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || !documentWithTransition.startViewTransition) {
      applyNextTheme()
      return
    }

    isTransitioning.value = true
    let themeApplied = false
    const applyTheme = () => {
      if (themeApplied)
        return

      themeApplied = true
      applyNextTheme()
    }

    try {
      const transition = documentWithTransition.startViewTransition(applyTheme)
      try {
        await transition.ready
        const originX = event?.clientX ?? window.innerWidth / 2
        const originY = event?.clientY ?? window.innerHeight / 2
        const radius = Math.hypot(
          Math.max(originX, window.innerWidth - originX),
          Math.max(originY, window.innerHeight - originY),
        )
        document.documentElement.animate(
          [
            { clipPath: `circle(0px at ${originX}px ${originY}px)` },
            { clipPath: `circle(${radius}px at ${originX}px ${originY}px)` },
          ],
          {
            duration: themeTransitionDuration,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      }
      catch {
        applyTheme()
      }
      await transition.finished.catch(() => undefined)
    }
    catch {
      applyTheme()
    }
    finally {
      isTransitioning.value = false
    }
  }

  return {
    activeTheme,
    isTransitioning: readonly(isTransitioning),
    toggle,
  }
}
