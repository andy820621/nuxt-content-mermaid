# Manual Theme Control

## Overview
過去我們是透過直接整合 `@nuxtjs/color-mode` 來控制 Mermaid 的暗淺模式切換。
但有時候您可能需要更細緻的主題控制，因此現在我們提供了一個 `useMermaidTheme` composable 可用來手動管理 Mermaid 主題：

## 設定方式

可於 nuxt.config.ts 中設定（`@nuxtjs/color-mode` 也是根據這個設定來切換）：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@barzhsieh/nuxt-content-mermaid'],
  contentMermaid: {
    theme: {
      light: 'default',         // 淺色主題
      dark: 'dark',             // 深色主題
    },
  },
})
```

> 若專案同時使用 `@nuxtjs/color-mode`，模組會自動使用這套設定去做主題切換；但如果若使用使用 `useMermaidTheme` API 的話，模組會優先根據手動設定。

### useMermaidTheme 基本用法

```vue
<script setup>
import { useMermaidTheme } from '@barzhsieh/nuxt-content-mermaid'

const { setMermaidTheme, currentTheme } = useMermaidTheme()

function toggleTheme() {
  setMermaidTheme(currentTheme.value === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <button @click="toggleTheme">切換主題</button>
</template>
```

## 支援的主題

### 預留關鍵字（保留字） - Strict Semantic Resolution
`'dark'` 和 `'light'` 是預留關鍵字，代表一種**策略** 而非單純的值：

#### `'dark'` 策略
- **永遠** 回傳深色主題
- 若配置了 `contentMermaid.theme.dark`，使用該配置
- 若未配置，回落到 Mermaid 內建的 `'dark'` 主題

```typescript
setMermaidTheme('dark')  // 總是深色，即使未設定 theme.dark
```

#### `'light'` 策略
- **永遠** 回傳淺色主題
- 若配置了 `contentMermaid.theme.light`，使用該配置
- 若未配置，回落到 Mermaid 內建的 `'default'` 主題

```typescript
setMermaidTheme('light')  // 總是淺色，即使未設定 theme.light
```

### 直接主題名稱
任何其他字符串（如 `'forest'`、`'neutral'`、`'base'`）視為直接指定 Mermaid 官方主題，直接傳遞使用，不經過任何 fallback 邏輯：

```typescript
setMermaidTheme('forest')    // 直接使用 Mermaid 的 forest 主題
setMermaidTheme('neutral')   // 直接使用 Mermaid 的 neutral 主題
setMermaidTheme('base')      // 直接使用 Mermaid 的 base 主題
setMermaidTheme(null)        // 重置為自動模式（如果有安裝 @nuxtjs/color-mode，則會跟隨 `contentMermaid.theme`)
```


## API 細節

### `useMermaidTheme()`

返回一個包含以下屬性和方法的物件。

#### 屬性

##### `currentTheme`：當前的手動主題模式
  - `'light'` / `'dark'`: 活躍的主題
  - 完整主題名稱: 直接設定的官方主題
  - `null`: 自動模式（無手動覆蓋）

#### 方法

##### `setMermaidTheme(mode)`：用於設定 Mermaid 主題。

```typescript
function setMermaidTheme(mode: MermaidThemeMode): void
```

**參數**:
- `mode`: `MermaidThemeMode` - 可以是：
  - 簡寫模式: `'light'` (使用 `contentMermaid.theme.light` 配置) | `'dark'` (使用 `contentMermaid.theme.dark` 配置)
  - 官方主題: `'default'` | `'forest'` | `'dark'` | `'neutral'` | `'base'` 等
  - `null`: 重置為自動模式

**範例**:
```typescript
setMermaidTheme('dark')        // 切換到深色主題
setMermaidTheme('forest')      // 使用 forest 主題
setMermaidTheme(null)          // 重置為自動模式
```

##### `setMermaidTheme(mode)`
設定 Mermaid 主題。

```typescript
function setMermaidTheme(mode: MermaidThemeMode): void
```

**參數**:
- `mode`: `MermaidThemeMode` - 可以是：
  - 簡寫模式: `'light'` (使用 `contentMermaid.theme.light` 配置) | `'dark'` (使用 `contentMermaid.theme.dark` 配置)
  - 官方主題: `'default'` | `'forest'` | `'dark'` | `'neutral'` | `'base'` 等
  - `null`: 重置為自動模式

**區別說明**:
- `setMermaidTheme('light')` 會映射到配置的 `contentMermaid.theme.light` 值
- `setMermaidTheme('dark')` 會映射到配置的 `contentMermaid.theme.dark` 值
- `setMermaidTheme('forest')` 直接使用 Mermaid 的 forest 主題，不經過配置

**範例**:
```typescript
setMermaidTheme('dark')        // 使用配置的深色主題
setMermaidTheme('forest')      // 直接使用 Mermaid 的 forest 主題
setMermaidTheme('light')       // 使用配置的淺色主題
setMermaidTheme(null)          // 重置為自動模式
```

##### `getMermaidTheme()`：取得當前的手動主題模式。

```typescript
function getMermaidTheme(): MermaidThemeMode
```

**範例**:
```typescript
const theme = getMermaidTheme()
console.log(theme) // 'dark' | 'light' | 'default' | ... | null
```

##### `resetMermaidTheme()`：重置到自動模式。

```typescript
function resetMermaidTheme(): void
```

**等同於**: `setMermaidTheme(null)`

## 主題優先級

當解析 Mermaid 主題時，以下優先順序適用（從高到低）：

1. **Frontmatter 配置** - Markdown 檔案中的 `config.theme`
   ```markdown
   ---
   config:
     theme: 'forest'
   ---
   ```

2. **手動設定** - 透過 `useMermaidTheme().setMermaidTheme()` 設定
   - `setMermaidTheme('dark')` → Strict Semantic Resolution: `darkTheme ?? 'dark'`
   - `setMermaidTheme('light')` → Strict Semantic Resolution: `lightTheme ?? 'default'`
   - `setMermaidTheme('forest')` → 直接使用，無 fallback

3. **Color Mode 整合** - 若專案安裝了 `@nuxtjs/color-mode`，Mermaid 會自動跟隨
   - 深色模式 → Strict Semantic Resolution: `darkTheme ?? 'dark'`
   - 淺色模式 → Strict Semantic Resolution: `lightTheme ?? 'default'`

4. **基礎主題** - `nuxt.config.ts` 中的 `loader.init.theme`
   ```typescript
   contentMermaid: {
     loader: {
       init: { theme: 'neutral' }
     }
   }
   ```

5. **預設主題** - 最後回退到 `theme.light` 或 `'default'`
   ```typescript
   contentMermaid: {
     theme: {
       light: 'default',
       // dark: 'dark' // 即使沒設定，fallback 也不會用到 dark
     }
   }
   ```

## 與 @nuxtjs/color-mode 共存

安裝 `@nuxtjs/color-mode` 時會自動偵測並跟隨 `contentMermaid.theme`。若想暫時鎖定或覆蓋 color-mode，可在客戶端使用 `useMermaidTheme()`：

```typescript
const { setMermaidTheme, resetMermaidTheme } = useMermaidTheme()

setMermaidTheme('dark')   // 鎖定為深色（覆蓋 color-mode）
resetMermaidTheme()       // 回到自動模式，重新跟隨 color-mode
```
手動設定會優先於 color-mode，直到你呼叫 `resetMermaidTheme()`。

## 類型定義

```typescript
/**
 * 預留關鍵字：代表策略而非單純的值
 * 'light': 淺色策略 → lightTheme ?? 'default'
 * 'dark': 深色策略 → darkTheme ?? 'dark'
 */
export type SimpleMermaidTheme = 'light' | 'dark'

/**
 * Mermaid 主題類型
 * - 預留關鍵字: 'light', 'dark' (Strict Semantic Resolution)
 * - 直接主題名稱: 'default', 'forest', 'dark', 'neutral', 'base' 等 (由 Mermaid 官方定義)
 * - null: 重置為自動模式
 */
export type MermaidThemeMode = MermaidConfig['theme'] | SimpleMermaidTheme | null

export function useMermaidTheme(): {
  currentTheme: Ref<MermaidThemeMode>
  setMermaidTheme: (mode: MermaidThemeMode) => void
  getMermaidTheme: () => MermaidThemeMode
  resetMermaidTheme: () => void
}
```
