/**
 * OKLCH colour values, and the conversion React Native needs.
 *
 * The board palettes are authored in OKLCH because that is what makes them
 * tunable: lightness is perceptual, so "same colour, one step darker for dark
 * mode" is a single number, and chroma stays put instead of drifting the way it
 * does in HSL. The web app hands the values straight to CSS.
 *
 * React Native cannot. Its colour parser (`@react-native/normalize-colors`)
 * understands hex, `rgb()`, `hsl()`, `hwb()` and named colours — and nothing
 * else. Passing `oklch(0.84 0.13 78)` into a `StyleSheet` does not throw, it
 * silently yields no colour. So the values stay authored in OKLCH and are
 * converted here.
 */

export interface Oklch {
  /** Perceptual lightness, 0–1. */
  l: number;
  /** Chroma, 0 to roughly 0.4. */
  c: number;
  /** Hue angle in degrees. */
  h: number;
  /** 0–1. Omitted means opaque. */
  alpha?: number;
}

/** The CSS form, for the web app's custom properties. */
export function oklchCss({ l, c, h, alpha }: Oklch): string {
  const base = `${trim(l)} ${trim(c)} ${trim(h)}`;
  return alpha === undefined
    ? `oklch(${base})`
    : `oklch(${base} / ${trim(alpha)})`;
}

/**
 * sRGB hex for React Native: `#rrggbb`, or `#rrggbbaa` when there is alpha.
 *
 * Björn Ottosson's published OKLab matrices followed by the sRGB transfer
 * function — and, when the colour does not fit in sRGB, **chroma reduction at
 * constant lightness and hue**, which is what CSS Color 4 specifies and
 * therefore what a browser does to these same values.
 *
 * Three authored palette colours are outside sRGB, the worst by −0.21 on the
 * red channel in linear light. For those three, reducing chroma and clipping
 * per channel land within 1–3 of each other on an 8-bit channel (`#00828d` vs
 * `#00818c`) — gamma encoding swallows most of the overshoot, so clipping would
 * not actually have been visible here. The reason to do it properly is the
 * colour nobody has authored yet: at high chroma the two diverge sharply
 * (`#007835` vs `#009100`), and clipping shifts the *hue*, which is the one
 * thing a palette cannot survive.
 */
export function oklchToHex(color: Oklch): string {
  const fitted = fitToSrgb(color);
  const [r, g, b] = srgbChannels(fitted);
  return (
    '#' +
    byte(r) +
    byte(g) +
    byte(b) +
    (color.alpha === undefined ? '' : byte(color.alpha))
  );
}

/**
 * The nearest colour sRGB can show, found by bisecting chroma. Lightness and
 * hue are preserved, so a mapped colour reads as the same colour slightly less
 * vivid — never as a different hue, which is what clipping produces.
 */
export function fitToSrgb(color: Oklch): Oklch {
  if (isInSrgbGamut(color)) return color;

  let low = 0;
  let high = color.c;
  // 20 halvings takes the interval under 1e-6 of a chroma unit, far below
  // anything an 8-bit channel can show.
  for (let i = 0; i < 20; i += 1) {
    const mid = (low + high) / 2;
    if (isInSrgbGamut({ ...color, c: mid })) low = mid;
    else high = mid;
  }
  return { ...color, c: low };
}

/**
 * Half of one 8-bit step. A channel this far outside [0, 1] rounds to the same
 * byte either way, so treating it as in-gamut changes no pixel — and without
 * the slack the sRGB primaries themselves fail, since `oklch(0.452014 0.313214
 * 264.052)` is blue rounded to six decimals and lands at −0.000002 on red.
 */
const SRGB_EPSILON = 1 / 510;

/**
 * True when every channel lands inside sRGB — i.e. the hex above is the colour
 * that was authored, not the nearest one that fits.
 */
export function isInSrgbGamut(color: Oklch): boolean {
  return srgbChannels(color).every(
    (v) => v >= -SRGB_EPSILON && v <= 1 + SRGB_EPSILON,
  );
}

/** Gamma-encoded sRGB, 0–1 per channel, **unclamped** so the caller can tell. */
function srgbChannels({ l, c, h }: Oklch): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // OKLab → LMS, via the cube roots of the cone responses.
  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;

  const long = lRoot * lRoot * lRoot;
  const medium = mRoot * mRoot * mRoot;
  const short = sRoot * sRoot * sRoot;

  // LMS → linear sRGB.
  return [
    encode(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short),
    encode(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short),
    encode(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short),
  ];
}

function encode(linear: number): number {
  if (linear <= 0.0031308) return 12.92 * linear;
  return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
}

function byte(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
}

/** `0.840000` → `0.84`, so generated CSS reads like hand-written CSS. */
function trim(value: number): string {
  return String(Number(value.toFixed(6)));
}
