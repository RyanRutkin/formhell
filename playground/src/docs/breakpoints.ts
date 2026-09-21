/**
 * Docs layout breakpoints, in pixels. Keep these in sync with the `@media` rules in docs.css — CSS media
 * queries cannot read custom properties, so the values are necessarily duplicated there.
 */
export const DOCS_BREAKPOINTS = {
  /** At or below this width the sidebar collapses behind the nav toggle. */
  sidebarCollapse: 900,
  /** At or below this width the theming demo stacks vertically. */
  themingStack: 1000,
  /** At or below this width the async $ref demo stacks vertically. */
  asyncRefStack: 1160,
    /** Big boy - the full screen affect gets more fun interactivity. */
    bigBoy: 1500,
} as const;

export type DocsBreakpoint = keyof typeof DOCS_BREAKPOINTS;

export function maxWidthQuery(width: number): string {
  return `(max-width: ${width}px)`;
}

// Offset by a fraction so fractional viewport widths cannot fall between the max- and min-width ranges.
export function minWidthQuery(width: number): string {
  return `(min-width: ${width + 0.02}px)`;
}

export const DOCS_MEDIA_QUERIES = {
  compact: maxWidthQuery(DOCS_BREAKPOINTS.sidebarCollapse),
  expanded: minWidthQuery(DOCS_BREAKPOINTS.sidebarCollapse),
  themingStacked: maxWidthQuery(DOCS_BREAKPOINTS.themingStack),
  themingSideBySide: minWidthQuery(DOCS_BREAKPOINTS.themingStack),
  asyncRefStacked: maxWidthQuery(DOCS_BREAKPOINTS.asyncRefStack),
  asyncRefSideBySide: minWidthQuery(DOCS_BREAKPOINTS.asyncRefStack),
  bigBoy: minWidthQuery(DOCS_BREAKPOINTS.bigBoy),
} as const;
