let renderQueue = Promise.resolve()
let queueSize = 0

export function enqueueRender(task: () => Promise<void>, debug = false): Promise<void> {
  queueSize++
  if (debug) {
    console.log(`[nuxt-content-mermaid] 🔵 Enqueueing task. Queue size: ${queueSize}`)
  }

  const wrappedTask = async () => {
    if (debug) {
      console.log(`[nuxt-content-mermaid] 🟢 Starting render task. Pending: ${queueSize - 1}`)
    }
    try {
      await task()
    }
    catch (e) {
      console.error('[nuxt-content-mermaid] Render error:', e)
      throw e
    }
    finally {
      queueSize--
      if (debug) {
        console.log(`[nuxt-content-mermaid] ✅ Task finished. Remaining: ${queueSize}`)
      }
    }
  }

  renderQueue = renderQueue.then(wrappedTask).catch((e) => {
    if (debug) {
      console.error('[nuxt-content-mermaid] ❌ Queue chain caught error:', e)
    }
  })

  return renderQueue
}

export function parseSizeToPx(value?: string | number, defaultSize = 14): number {
  if (value === undefined || value === null) return defaultSize
  if (typeof value === 'number') return value

  const match = value.match(/^([\d.]+)(px|rem|em)?$/)
  if (!match) return defaultSize

  const num = Number.parseFloat(match[1] || '0')
  const unit = match[2] || 'px'

  if (unit === 'rem' || unit === 'em') {
    return num * 16
  }

  return num
}

export function promiseTimeout(
  ms: number,
  throwOnTimeout = false,
  reason = 'Timeout',
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (throwOnTimeout)
      setTimeout(() => reject(reason), ms)
    else
      setTimeout(resolve, ms)
  })
}

export function identity<T>(arg: T): T {
  return arg
}

export interface SingletonPromiseReturn<T> {
  (): Promise<T>
  /**
   * Reset current staled promise.
   * await it to have proper shutdown.
   */
  reset: () => Promise<void>
}

/**
 * Create singleton promise function
 *
 * @example
 * ```
 * const promise = createSingletonPromise(async () => { ... })
 *
 * await promise()
 * await promise() // all of them will be bind to a single promise instance
 * await promise() // and be resolved together
 * ```
 */
export function createSingletonPromise<T>(fn: () => Promise<T>): SingletonPromiseReturn<T> {
  let _promise: Promise<T> | undefined

  function wrapper() {
    if (!_promise)
      _promise = fn()
    return _promise
  }
  wrapper.reset = async () => {
    const _prev = _promise
    _promise = undefined
    if (_prev)
      await _prev
  }

  return wrapper
}

export function invoke<T>(fn: () => T): T {
  return fn()
}

export function containsProp(obj: object, ...props: string[]) {
  return props.some(k => k in obj)
}

/**
 * Increase string a value with unit
 *
 * @example '2px' + 1 = '3px'
 * @example '15em' + (-2) = '13em'
 */
export function increaseWithUnit(target: number, delta: number): number
export function increaseWithUnit(target: string, delta: number): string
export function increaseWithUnit(target: string | number, delta: number): string | number
export function increaseWithUnit(target: string | number, delta: number): string | number {
  if (typeof target === 'number')
    return target + delta
  const value = target.match(/^-?\d+\.?\d*/)?.[0] || ''
  const unit = target.slice(value.length)
  const result = (Number.parseFloat(value) + delta)
  if (Number.isNaN(result))
    return target
  return result + unit
}

/**
 * Create a new subset object by giving keys
 */
export function objectPick<O extends object, T extends keyof O>(obj: O, keys: T[], omitUndefined = false) {
  return keys.reduce((n, k) => {
    if (k in obj) {
      if (!omitUndefined || obj[k] !== undefined)
        n[k] = obj[k]
    }
    return n
  }, {} as Pick<O, T>)
}

/**
 * Create a new subset object by omit giving keys
 */
export function objectOmit<O extends object, T extends keyof O>(obj: O, keys: T[], omitUndefined = false) {
  return Object.fromEntries(Object.entries(obj).filter(([key, value]) => {
    return (!omitUndefined || value !== undefined) && !keys.includes(key as T)
  })) as Omit<O, T>
}

export function objectEntries<T extends object>(obj: T) {
  return Object.entries(obj) as Array<[keyof T, T[keyof T]]>
}

export function toArray<T>(value: T | readonly T[]): readonly T[]
export function toArray<T>(value: T | T[]): T[]
export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

export function stringifyInlineValue(value: Record<string, unknown>) {
  return escapeHtmlAttribute(JSON.stringify(value))
}

export * from './is'
export * from './vue'
export * from './mermaid-transform'
