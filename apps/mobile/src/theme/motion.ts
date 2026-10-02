/**
 * Shared durations, so motion across the app reads as one system rather than
 * each screen picking its own timing.
 */
export const motion = {
  /** State feedback: press, toggle. */
  fast: 150,
  /** Element transitions: enter, exit. */
  base: 250,
  /** Large surfaces: sheets, screens. */
  slow: 400,
} as const;
