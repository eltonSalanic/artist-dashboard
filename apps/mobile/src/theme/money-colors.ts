/**
 * The phone app's greens and reds for money: in, out, owed and paid back.
 * A shade or two deeper than the shared `FINANCE_COLORS` the web app uses, so
 * the figures read as solid ink rather than bright highlights. `light` is for
 * the cream page, `dark` for the black one, and `onColor` for a figure on a
 * coloured widget card, in either scheme.
 */
export const MONEY_COLORS = {
  light: { positive: '#065f46', negative: '#991b1b' },
  dark: { positive: '#10b981', negative: '#ef4444' },
  onColor: { positive: '#047857', negative: '#b91c1c' },
} as const;
