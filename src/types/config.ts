import type { MermaidConfig } from 'mermaid'
import type { ExpandOptions } from '../runtime/types/expand'
import type { MermaidToolbarOptions } from './mermaid'

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

type IsAny<T> = 0 extends (1 & T) ? true : false

type RuntimeDataMember<T> = IsAny<T> extends true
  ? never
  : T extends JsonPrimitive
    ? T
    : T extends (...args: never[]) => unknown
      ? never
      : T extends readonly (infer Item)[]
        ? RuntimeDataMember<Item>[]
        : T extends object
          ? { [Key in keyof T]: RuntimeDataMember<T[Key]> }
          : never

export type RuntimeMermaidConfig = RuntimeDataMember<MermaidConfig> & JsonObject
export type PageMermaidConfig = RuntimeMermaidConfig

export interface RuntimeOptions {
  /**
   * Enable debug mode for detailed logging and error reporting
   * @default false
   */
  debug?: boolean
  /**
   * Options related to loading mermaid
   */
  loader?: {
    /**
     * Pure-data configuration passed through Nuxt public runtime config.
     */
    init?: RuntimeMermaidConfig
    /**
     * Whether to lazy load the diagram when it enters the viewport.
     * Can be a boolean or an object with IntersectionObserver options.
     * @default true
     */
    lazy?: boolean | { threshold?: number }
  }
  /**
   * Options related to theme handling
   */
  theme?: {
    /** @deprecated No effect; retained for 3.0 compatibility. */
    useColorModeTheme?: boolean
    light?: MermaidConfig['theme']
    dark?: MermaidConfig['theme']
  }
  /**
   * Names for custom implementation components
   */
  components?: {
    renderer?: string
    spinner?: string
    error?: string
  }
  /**
   * Expand configuration. `false` disables expand, `true` uses defaults.
   */
  expand?: ExpandOptions | boolean
  /**
   * Default toolbar settings for Mermaid component
   */
  toolbar?: MermaidToolbarOptions
}

export interface ModuleOptions extends RuntimeOptions {
  /**
   * Whether to enable the entire Mermaid process at build time.
   * @default true
   */
  enabled?: boolean
}

interface MermaidComponentBaseProps {
  toolbar?: MermaidToolbarOptions
  code?: string
}

export type MermaidComponentProps = MermaidComponentBaseProps & (
  | { pageConfig?: PageMermaidConfig, config?: never }
  | { pageConfig?: never, config?: MermaidConfig }
)
