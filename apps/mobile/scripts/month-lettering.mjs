// Hand-letters "NOTHING IN <MONTH>." for each month, in the style of the
// "NO GIGS YET." drawn into the mascots' `empty` pose: thick round-capped
// marker strokes, every letter a little off its neighbours, boiling through
// three frames. No dependencies.
//
//   node scripts/month-lettering.mjs <src dir> <out dir>
//
// Writes <src dir>/lettering/<month>.svg (the drawings, 3 SMIL frames like the
// mascot SVGs) and <out dir>/lettering/<month>{,-dark}.json via svg-to-lottie,
// plus <out dir>/lettering/index.ts.
import fs from 'node:fs';
import path from 'node:path';
import { svgToLottie } from './svg-to-lottie.mjs';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

// Same weight and size as "NO GIGS YET." in poses.svg: 4.54 stroke, ~30 tall.
const H = 30;
const STROKE = 4.54;
const INK = '#080706';
const TRACK = 9;      // gap between letters
const SPACE = 20;     // a word gap
const LINE = 52;      // baseline to baseline
const PAD = 8;

// ---------- the alphabet: capitals as strokes on a box H tall ----------
// Each glyph is [width, strokes]; a stroke is a list of [x, y] points, y down.
const arc = (cx, cy, rx, ry, from, to, n = 10) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
const GLYPHS = {
  A: [20, [[[0, H], [10, 0], [20, H]], [[4, 19], [16, 19]]]],
  B: [17, [[[0, H], [0, 0]], [[0, 0], ...arc(8, 7, 8, 7, -90, 90, 8), [0, 14]], [[0, 14], ...arc(9, 22, 8, 8, -90, 90, 8), [0, H]]]],
  C: [19, [arc(11, 15, 10, 15, -40, -320, 14)]],
  D: [19, [[[0, 0], [0, H]], [[0, 0], [5, 0], ...arc(5, 15, 14, 15, -90, 90, 12), [0, H]]]],
  E: [16, [[[16, 0], [0, 0], [0, H], [16, H]], [[0, 14], [12, 14]]]],
  F: [15, [[[15, 0], [0, 0], [0, H]], [[0, 14], [11, 14]]]],
  G: [20, [[...arc(11, 15, 10, 15, -40, -340, 14), [20, 17], [12, 17]]]],
  H: [18, [[[0, 0], [0, H]], [[18, 0], [18, H]], [[0, 15], [18, 15]]]],
  I: [0, [[[0, 0], [0, H]]]],
  J: [14, [[[14, 0], [14, 21], ...arc(7, 21, 7, 9, 0, 180, 8)]]],
  L: [14, [[[0, 0], [0, H], [14, H]]]],
  M: [24, [[[0, H], [0, 0], [12, 18], [24, 0], [24, H]]]],
  N: [18, [[[0, H], [0, 0], [18, H], [18, 0]]]],
  O: [22, [arc(11, 15, 11, 15, 0, 360, 16)]],
  P: [16, [[[0, H], [0, 0]], [[0, 0], ...arc(8, 8, 8, 8, -90, 90, 8), [0, 16]]]],
  R: [17, [[[0, H], [0, 0]], [[0, 0], ...arc(8, 8, 8, 8, -90, 90, 8), [0, 16]], [[6, 16], [17, H]]]],
  S: [17, [[...arc(9, 7.5, 8, 7.5, -20, -270, 8), ...arc(8, 22.5, 9, 7.5, -90, 160, 8)]]],
  T: [18, [[[0, 0], [18, 0]], [[9, 0], [9, H]]]],
  U: [18, [[[0, 0], [0, 20], ...arc(9, 20, 9, 10, 180, 0, 10), [18, 0]]]],
  V: [20, [[[0, 0], [10, H], [20, 0]]]],
  Y: [20, [[[0, 0], [10, 15], [20, 0]], [[10, 15], [10, H]]]],
  '.': [1, [[[0, H - 1], [0.6, H - 0.4]]]],
};

// ---------- a seeded hand: small, repeatable unsteadiness ----------
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const R = (n) => Math.round(n * 10) / 10;

// Resample a stroke every few units so a long line can wander, not just its ends.
function resample(points, step = 7) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

// Catmull-Rom through the points, written as cubics like the hand-drawn paths.
function smoothPath(pts) {
  if (pts.length === 2) {
    const [[x0, y0], [x1, y1]] = pts;
    return `M${R(x0)} ${R(y0)} L${R(x1)} ${R(y1)}`;
  }
  let d = `M${R(pts[0][0])} ${R(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${R(c1[0])} ${R(c1[1])} ${R(c2[0])} ${R(c2[1])} ${R(p2[0])} ${R(p2[1])}`;
  }
  return d;
}

// Lay out the lines once: each letter keeps its own tilt, size and baseline
// across frames (that's the hand), and only the wobble changes frame to frame.
function layout(lines, seed) {
  const r = rng(seed);
  const placed = [];
  let width = 0;
  lines.forEach((text, row) => {
    const letters = [];
    let x = 0;
    for (const ch of text) {
      if (ch === ' ') { x += SPACE; continue; }
      const [w, strokes] = GLYPHS[ch];
      const scale = 0.94 + r() * 0.14;
      const tilt = ((r() - 0.5) * 7 * Math.PI) / 180;
      const dy = (r() - 0.5) * 4;
      letters.push({ x, w, strokes, scale, tilt, dy });
      x += w * scale + TRACK + (ch === '.' ? 0 : (r() - 0.5) * 2);
    }
    x -= TRACK;
    placed.push({ row, letters, width: x });
    width = Math.max(width, x);
  });
  return { placed, width };
}

function frame(lay, seed) {
  const r = rng(seed);
  const paths = [];
  for (const { row, letters, width } of lay.placed) {
    const offset = (lay.width - width) / 2 + PAD; // each line centred
    for (const { x, w, strokes, scale, tilt, dy } of letters) {
      const cx = (w * scale) / 2, cy = H / 2;
      for (const stroke of strokes) {
        const pts = resample(stroke).map(([px, py]) => {
          // scale and tilt about the letter's middle, then a little tremor
          const sx = px * scale - cx, sy = py * scale - cy * scale;
          const tx = sx * Math.cos(tilt) - sy * Math.sin(tilt) + cx;
          const ty = sx * Math.sin(tilt) + sy * Math.cos(tilt) + cy;
          return [
            offset + x + tx + (r() - 0.5) * 1.6,
            PAD + row * LINE + dy + ty + (r() - 0.5) * 1.6,
          ];
        });
        paths.push(`<path d="${smoothPath(pts)}" fill="none" stroke="${INK}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }
  }
  return paths.join('\n');
}

function lettering(lines, seed) {
  const lay = layout(lines, seed);
  const w = Math.ceil(lay.width + PAD * 2);
  const h = Math.ceil(PAD * 2 + H + LINE * (lines.length - 1) + 4);
  const frames = [0, 1, 2].map((i) => {
    const values = ['visible', 'hidden', 'hidden'].map((_, k) => (k === i ? 'visible' : 'hidden')).join(';');
    return `<g visibility="${i === 0 ? 'visible' : 'hidden'}"><animate attributeName="visibility" values="${values}" dur="0.36s" repeatCount="indefinite" calcMode="discrete"/>\n${frame(lay, seed * 7 + i + 1)}\n</g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${frames.join('\n')}</svg>\n`;
}

const [SRC = 'assets/mascots/src', OUT = 'assets/mascots/lottie'] = process.argv.slice(2);
const srcDir = path.join(SRC, 'lettering'), outDir = path.join(OUT, 'lettering');
fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
const entries = [];
MONTHS.forEach((month, i) => {
  const svg = lettering(['NOTHING IN', `${month.toUpperCase()}.`], 101 + i);
  fs.writeFileSync(path.join(srcDir, `${month}.svg`), svg);
  for (const [suffix, inkTo] of [['', null], ['-dark', '#FFFFFF']]) {
    fs.writeFileSync(path.join(outDir, `${month}${suffix}.json`), JSON.stringify(svgToLottie(svg, `nothing in ${month}`, undefined, null, inkTo)));
  }
  entries.push(`  [require('./${month}.json'), require('./${month}-dark.json')],`);
});
fs.writeFileSync(path.join(outDir, 'index.ts'),
  '// AUTO-GENERATED by scripts/month-lettering.mjs. Do not edit.\n' +
  '/** "NOTHING IN <MONTH>." hand-lettered, by month index (0 = January): [light, dark]. */\n' +
  `export const MONTH_LETTERING = [\n${entries.join('\n')}\n] as const;\n`);
console.log(`wrote ${MONTHS.length} lettered months to ${srcDir} and ${outDir}`);
