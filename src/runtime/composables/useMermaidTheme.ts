import { useState } from '#app'
import type { MermaidConfig } from 'mermaid'

/**
 * Switch between configured dark/light themes
 * - 'light': corresponds to contentMermaid.theme.light setting
 * - 'dark': corresponds to contentMermaid.theme.dark setting
 */
export type SimpleMermaidTheme = 'light' | 'dark'

/**
 * Mermaid theme type
 * Can be:
 * - Simple mode: 'light', 'dark' (corresponds to configured light/dark theme)
 * - Official themes: 'default', 'forest', 'dark', 'neutral', 'base', etc.
 *   @see https://mermaid.js.org/config/schema-docs/config.html?#theme
 * - null: Reset to auto mode
 */
export type MermaidThemeMode = MermaidConfig['theme'] | SimpleMermaidTheme | null

/**
 * Composable for managing Mermaid theme independently of @nuxtjs/color-mode
 *
 * @example
 * ```vue
 * <script setup>
 * const { setMermaidTheme, currentTheme } = useMermaidTheme()
 *
 * function toggleTheme() {
 *   setMermaidTheme(currentTheme.value === 'dark' ? 'light' : 'dark')
 * }
 * </script>
 * ```
 */
export function useMermaidTheme() {
  /**
   * Global reactive state for manual theme mode
   * null means no manual override (will use colorMode or default)
   */
  const manualThemeMode = useState<MermaidThemeMode>('mermaid-theme-mode', () => null)

  /**
   * Set the Mermaid theme manually
   * @param mode - Theme to set. Can be:
   *   - Simple mode: 'light' (uses configured light theme), 'dark' (uses configured dark theme)
   *   - Direct Mermaid theme: 'default', 'forest', 'dark', 'neutral', 'base', etc.
   *   - null: Reset to auto mode (no manual override)
   * @example
   * setMermaidTheme('dark')        // Use configured dark theme
   * setMermaidTheme('forest')      // Use Mermaid's forest theme directly
   * setMermaidTheme('light')       // Use configured light theme
   * setMermaidTheme(null)          // Reset to auto mode
   */
  function setMermaidTheme(mode: MermaidThemeMode) {
    manualThemeMode.value = mode
  }

  /**
   * Get the current manual theme mode
   */
  function getMermaidTheme() {
    return manualThemeMode.value
  }

  /**
   * Reset to automatic theme mode (use colorMode or default)
   */
  function resetMermaidTheme() {
    manualThemeMode.value = null
  }

  return {
    /**
     * The current manual theme mode (reactive ref)
     */
    currentTheme: manualThemeMode,
    /**
     * Set the Mermaid theme manually
     */
    setMermaidTheme,
    /**
     * Get the current manual theme mode
     */
    getMermaidTheme,
    /**
     * Reset to automatic theme mode
     */
    resetMermaidTheme,
  }
}
