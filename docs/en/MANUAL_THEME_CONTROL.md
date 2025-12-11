# Manual Theme Control

## Overview
Previously, we integrated `@nuxtjs/color-mode` directly to control Mermaid's light/dark mode switching. However, you may sometimes need more fine-grained theme control. Therefore, we now provide a `useMermaidTheme` composable for manual Mermaid theme management.

## Configuration

Configure in nuxt.config.ts (`@nuxtjs/color-mode` also switches themes based on this configuration):

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@barzhsieh/nuxt-content-mermaid'],
  contentMermaid: {
    theme: {
      light: 'default',         // Light theme
      dark: 'dark',             // Dark theme
    },
  },
})
```

> If your project also uses `@nuxtjs/color-mode`, the module will automatically use this configuration for theme switching. However, if you use the `useMermaidTheme` API, manual settings will take priority.

### useMermaidTheme Basic Usage

```vue
<script setup>
import { useMermaidTheme } from '@barzhsieh/nuxt-content-mermaid'

const { setMermaidTheme, currentTheme } = useMermaidTheme()

function toggleTheme() {
  setMermaidTheme(currentTheme.value === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <button @click="toggleTheme">Toggle Theme</button>
</template>
```

## Supported Themes

### Reserved Keywords - Strict Semantic Resolution
`'dark'` and `'light'` are reserved keywords representing a **strategy** rather than simple values:

#### `'dark'` Strategy
- **Always** returns a dark theme
- If `contentMermaid.theme.dark` is configured, uses that configuration
- If not configured, falls back to Mermaid's built-in `'dark'` theme

```typescript
setMermaidTheme('dark')  // Always dark, even if theme.dark is not configured
```

#### `'light'` Strategy
- **Always** returns a light theme
- If `contentMermaid.theme.light` is configured, uses that configuration
- If not configured, falls back to Mermaid's built-in `'default'` theme

```typescript
setMermaidTheme('light')  // Always light, even if theme.light is not configured
```

### Direct Theme Names
Any other string (such as `'forest'`, `'neutral'`, `'base'`) is treated as a direct Mermaid official theme name and is passed through directly without any fallback logic:

```typescript
setMermaidTheme('forest')    // Directly uses Mermaid's forest theme
setMermaidTheme('neutral')   // Directly uses Mermaid's neutral theme
setMermaidTheme('base')      // Directly uses Mermaid's base theme
setMermaidTheme(null)        // Reset to automatic mode (if @nuxtjs/color-mode is installed, follows `contentMermaid.theme`)
```

## API Details

### `useMermaidTheme()`

Returns an object containing the following properties and methods.

#### Properties

##### `currentTheme`: Current manual theme mode
  - `'light'` / `'dark'`: Active theme strategy
  - Full theme name: Directly set official theme
  - `null`: Automatic mode (no manual override)

#### Methods

##### `setMermaidTheme(mode)`: Set the Mermaid theme

```typescript
function setMermaidTheme(mode: MermaidThemeMode): void
```

**Parameters**:
- `mode`: `MermaidThemeMode` - Can be:
  - Shorthand mode: `'light'` (uses `contentMermaid.theme.light` config) | `'dark'` (uses `contentMermaid.theme.dark` config)
  - Official themes: `'default'` | `'forest'` | `'dark'` | `'neutral'` | `'base'`, etc.
  - `null`: Reset to automatic mode

**Distinction**:
- `setMermaidTheme('light')` maps to the configured `contentMermaid.theme.light` value
- `setMermaidTheme('dark')` maps to the configured `contentMermaid.theme.dark` value
- `setMermaidTheme('forest')` directly uses Mermaid's forest theme, bypassing configuration

**Examples**:
```typescript
setMermaidTheme('dark')        // Use configured dark theme
setMermaidTheme('forest')      // Directly use Mermaid's forest theme
setMermaidTheme('light')       // Use configured light theme
setMermaidTheme(null)          // Reset to automatic mode
```

##### `getMermaidTheme()`: Get the current manual theme mode

```typescript
function getMermaidTheme(): MermaidThemeMode
```

**Example**:
```typescript
const theme = getMermaidTheme()
console.log(theme) // 'dark' | 'light' | 'default' | ... | null
```

##### `resetMermaidTheme()`: Reset to automatic mode

```typescript
function resetMermaidTheme(): void
```

**Equivalent to**: `setMermaidTheme(null)`

## Theme Priority

When resolving the Mermaid theme, the following priority order applies (from highest to lowest):

1. **Frontmatter Configuration** - `config.theme` in Markdown files
   ```markdown
   ---
   config:
     theme: 'forest'
   ---
   ```

2. **Manual Settings** - Set via `useMermaidTheme().setMermaidTheme()`
   - `setMermaidTheme('dark')` → Strict Semantic Resolution: `darkTheme ?? 'dark'`
   - `setMermaidTheme('light')` → Strict Semantic Resolution: `lightTheme ?? 'default'`
   - `setMermaidTheme('forest')` → Direct use, no fallback

3. **Color Mode Integration** - If `@nuxtjs/color-mode` is installed, Mermaid automatically follows it
   - Dark mode → Strict Semantic Resolution: `darkTheme ?? 'dark'`
   - Light mode → Strict Semantic Resolution: `lightTheme ?? 'default'`

4. **Base Theme** - `loader.init.theme` in `nuxt.config.ts`
   ```typescript
   contentMermaid: {
     loader: {
       init: { theme: 'neutral' }
     }
   }
   ```

5. **Default Theme** - Final fallback to `theme.light` or `'default'`
   ```typescript
   contentMermaid: {
     theme: {
       light: 'default',
       // dark: 'dark' // Even if not set, fallback won't use dark
     }
   }
   ```

## Coexistence with @nuxtjs/color-mode

When `@nuxtjs/color-mode` is installed, it automatically detects and follows `contentMermaid.theme`. To temporarily lock or override color-mode, use `useMermaidTheme()` on the client side:

```typescript
const { setMermaidTheme, resetMermaidTheme } = useMermaidTheme()

setMermaidTheme('dark')   // Lock to dark (overrides color-mode)
resetMermaidTheme()       // Return to automatic mode, resume following color-mode
```
Manual settings take priority over color-mode until you call `resetMermaidTheme()`.

## Type Definitions

```typescript
/**
 * Reserved keywords: Represent strategies rather than simple values
 * 'light': Light strategy → lightTheme ?? 'default'
 * 'dark': Dark strategy → darkTheme ?? 'dark'
 */
export type SimpleMermaidTheme = 'light' | 'dark'

/**
 * Mermaid theme type
 * - Reserved keywords: 'light', 'dark' (Strict Semantic Resolution)
 * - Direct theme names: 'default', 'forest', 'dark', 'neutral', 'base', etc. (defined by Mermaid official)
 * - null: Reset to automatic mode
 */
export type MermaidThemeMode = MermaidConfig['theme'] | SimpleMermaidTheme | null

export function useMermaidTheme(): {
  currentTheme: Ref<MermaidThemeMode>
  setMermaidTheme: (mode: MermaidThemeMode) => void
  getMermaidTheme: () => MermaidThemeMode
  resetMermaidTheme: () => void
}
```
