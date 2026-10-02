/**
 * One scale on a 4-point grid. Named by size, not by use, so a value is never
 * trapped in the first place it was needed.
 *
 * Screen edge padding is `md`. If a layout wants something between steps, use
 * the nearest step — the grid is the point.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
