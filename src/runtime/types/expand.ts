export interface ExpandInvokeOpenOn {
  /**
   * Allow clicking the SVG to open expand overlay.
   * @default true
   */
  diagramClick?: boolean
}

export interface ExpandInvokeCloseOn {
  /**
   * Allow Escape key to close.
   * @default true
   */
  esc?: boolean
  /**
   * Allow mouse wheel to close.
   * @default true
   */
  wheel?: boolean
  /**
   * Allow swipe gesture to close.
   * @default true
   */
  swipe?: boolean
  /**
   * Allow clicking the overlay background to close.
   * @default true
   */
  overlayClick?: boolean
  /**
   * Show the overlay close button.
   * @default true
   */
  closeButtonClick?: boolean
}

export interface ExpandOptions {
  /**
   * Enable or disable expand features entirely.
   * @default true
   */
  enabled?: boolean
  /**
   * Margin (px) kept around the expanded SVG within the viewport.
   * @default 0
   */
  margin?: number
  invokeOpenOn?: ExpandInvokeOpenOn
  invokeCloseOn?: ExpandInvokeCloseOn
}
