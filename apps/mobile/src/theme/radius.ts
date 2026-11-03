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

/**
 * Corner concentricity, from Apple's iOS 26 guidelines: a rounded shape
 * sitting in another's corner shares that corner's centre, so the gap between
 * the two curves stays even instead of pinching. The container's radius is
 * the child's plus the padding between them. A capsule child's radius is half
 * its height.
 *
 * Use it for a padded block whose corner holds a field, a button or a card.
 */
export function concentric(childRadius: number, padding: number): number {
  return childRadius + padding;
}
