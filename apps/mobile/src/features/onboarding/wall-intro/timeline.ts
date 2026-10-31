/**
 * The welcome preview's clock. Everything on screen is a pure function of one
 * time `t` in milliseconds, the way a video is, so tapping to skip a beat or
 * holding a beat still for reduced motion is just setting `t`.
 *
 * Plain worklets with no Reanimated import, so the curves can be tested in
 * node.
 */

/**
 * Five beats, like five story cards: the welcome, then the wall's events,
 * tasks and money, then the phone.
 */
export const BEATS = [2600, 3700, 3400, 3800, 4600] as const;
export const BEAT_START = BEATS.map((_, i) => BEATS.slice(0, i).reduce((a, b) => a + b, 0));
export const TOTAL = BEATS.reduce((a, b) => a + b, 0);
/** When the wall starts building, after the welcome. Its own moments count from here. */
export const WALL = BEAT_START[1];
/** When the wall turns into a phone on the band's colour. */
export const CUT = BEAT_START[4];
/** The welcome card lifting away to show the wall. */
export const LIFT = 550;

/**
 * The frame each beat holds on when motion is reduced: the welcome fully in,
 * a headline fully in, or for the last beat, the phone at rest.
 */
export const REST = [1500, WALL + 1080, WALL + 4820, WALL + 9370, TOTAL - 1] as const;

/** A card's flight from off screen into its cell, and the press-bounce after. */
export const LAND = 860;
/** A headline crossing the screen: in, hold, out. */
export const SWEEP = 1400;
/** The wall shrinking into the phone. */
export const SHRINK = 820;

/** The same curve CSS's `cubic-bezier()` draws, including overshoot past 1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  return (x: number): number => {
    'worklet';
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Solve for the curve parameter whose x is `x`: Newton first, and
    // bisection if it wanders, as browsers do.
    let s = x;
    for (let i = 0; i < 8; i += 1) {
      const fx = ((ax * s + bx) * s + cx) * s - x;
      if (Math.abs(fx) < 1e-6) return ((ay * s + by) * s + cy) * s;
      const d = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(d) < 1e-6) break;
      s -= fx / d;
    }
    let lo = 0;
    let hi = 1;
    s = x;
    for (let i = 0; i < 30; i += 1) {
      const fx = ((ax * s + bx) * s + cx) * s;
      if (Math.abs(fx - x) < 1e-6) break;
      if (fx < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return ((ay * s + by) * s + cy) * s;
  };
}

/** A springy settle that overshoots a little. */
export const SPRING = cubicBezier(0.34, 1.56, 0.64, 1);
/** A card's throw: fast, past its cell, back. */
export const FLY = cubicBezier(0.26, 1.32, 0.5, 1);
/** The press before the bounce. */
export const PRESS = cubicBezier(0.3, 0, 0.5, 1);
/** The app's morph curve, for the camera and a headline leaving. */
export const MORPH = cubicBezier(0.77, 0, 0.175, 1);
export const EASE_IN_OUT = cubicBezier(0.42, 0, 0.58, 1);

/** How long a highlight takes to come up, and to go. */
export const GLOW = 250;

/** How far through an animation `t` is, from 0 to 1. */
export function progress(t: number, at: number, duration: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (t - at) / duration));
}

/** Which beat `t` falls in. */
export function beatAt(t: number): number {
  'worklet';
  let beat = BEATS.length - 1;
  while (beat > 0 && t < BEAT_START[beat]) beat -= 1;
  return beat;
}

/**
 * A card landing at `at`. `away` is how much of its starting offset is left
 * (it dips below 0 as it overshoots), `scale` is the press-bounce once it's in.
 */
export function landing(t: number, at: number): { shown: boolean; away: number; scale: number } {
  'worklet';
  const p = (t - at) / LAND;
  if (p < 0) return { shown: false, away: 1, scale: 1 };
  if (p < 0.66) return { shown: true, away: 1 - FLY(p / 0.66), scale: 1 };
  if (p < 0.79) return { shown: true, away: 0, scale: 1 - 0.05 * PRESS((p - 0.66) / 0.13) };
  if (p < 1) return { shown: true, away: 0, scale: 0.95 + 0.05 * SPRING((p - 0.79) / 0.21) };
  return { shown: true, away: 0, scale: 1 };
}

/**
 * A headline band at `at`, as fractions of its width: it springs in from the
 * right, holds, then slides off to the left, its words a little behind it.
 */
export function sweep(t: number, at: number): { band: number; words: number } {
  'worklet';
  const p = (t - at) / SWEEP;
  if (p < 0) return { band: 1.15, words: 0.3 };
  if (p < 0.3) {
    const e = 1 - SPRING(p / 0.3);
    return { band: 1.15 * e, words: 0.3 * e };
  }
  if (p < 0.78) return { band: 0, words: 0 };
  const e = MORPH(Math.min(1, (p - 0.78) / 0.22));
  return { band: -1.15 * e, words: -0.45 * e };
}

export interface Pose {
  y: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
}

const FLAT: Pose = { y: 0, rx: 0, ry: 0, rz: 0, scale: 1 };

function mix(a: Pose, b: Pose, e: number): Pose {
  'worklet';
  return {
    y: a.y + (b.y - a.y) * e,
    rx: a.rx + (b.rx - a.rx) * e,
    ry: a.ry + (b.ry - a.ry) * e,
    rz: a.rz + (b.rz - a.rz) * e,
    scale: a.scale + (b.scale - a.scale) * e,
  };
}

/**
 * The wall as an object after the cut: it springs into a tilted phone, `top`
 * points down the screen and `scale` of its size, then drifts slowly so it
 * reads as a thing in space.
 */
export function phonePose(t: number, top: number, scale: number): Pose {
  'worklet';
  const q = t - CUT;
  if (q < 0) return FLAT;
  const landed: Pose = { y: top, rx: 9, ry: -24, rz: -3, scale };
  if (q < SHRINK) return mix(FLAT, landed, SPRING(q / SHRINK));
  const drift: Pose = { y: top - 6, rx: 7, ry: -12, rz: -2, scale };
  return mix(landed, drift, EASE_IN_OUT(Math.min(1, (q - SHRINK) / (BEATS[3] - SHRINK))));
}

/** How far the camera has ridden down the wall, from 0 to 1. */
export function cameraAt(t: number): number {
  'worklet';
  if (t < CUT) return MORPH(progress(t, BEAT_START[3] + 60, 1100));
  return 1 - MORPH(progress(t, CUT, 700));
}

/**
 * How much of the screen the welcome card still covers, from the top, as it
 * lifts away: 1 is all of it, 0 none.
 */
export function curtain(t: number): number {
  'worklet';
  if (t >= WALL) return 0;
  return 1 - MORPH(progress(t, WALL - LIFT, LIFT));
}

/** A highlight held from `from` to `to`, eased in and out: 0 off, 1 fully on. */
export function highlight(t: number, from: number, to: number): number {
  'worklet';
  if (t < from || t > to) return 0;
  const up = EASE_IN_OUT(Math.min(1, (t - from) / GLOW));
  const down = EASE_IN_OUT(Math.min(1, (to - t) / GLOW));
  return Math.min(up, down);
}
