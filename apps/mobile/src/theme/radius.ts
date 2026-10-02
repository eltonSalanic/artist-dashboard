/**
 * Derived from the web app's `--radius: 1.05rem` (16.8px) and the same
 * multiplier scale its stylesheet uses, rounded to whole pixels. The chunky
 * bento corner is part of the product's look, so it carries across rather than
 * being re-picked here.
 *
 * Pair every non-capsule radius with `borderCurve: "continuous"` — the squircle
 * iOS actually draws, instead of a circular arc that reads as slightly wrong.
 */
const base = 16.8;

export const radius = {
  sm: Math.round(base * 0.6), // 10
  md: Math.round(base * 0.8), // 13
  lg: Math.round(base), // 17
  xl: Math.round(base * 1.4), // 24
  /** Capsules: pills, avatars, chips. */
  full: 9999,
} as const;
