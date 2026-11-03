// Converts the boiling mascot SVGs (3 SMIL frames each) into Lottie JSON.
// No dependencies. Each boil frame becomes one shape layer shown for 120ms,
// looping forever: the same wobble the SVGs have in a browser.
//
//   node scripts/svg-to-lottie.mjs <src dir> <out dir>
//
// <src dir> layout (same as before):
//   <name>/{hero,poses,small}.svg             -> <name>/{hero,celebrate,empty,nudge,icon}.json
//   lockups/<name>/<lockup>-<light|dark>.svg  -> lockups/<name>/<lockup>-<light|dark>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FPS = 25;          // Lottie frame rate
const HOLD = 3;          // Lottie frames per boil frame: 3 / 25fps = 120ms
const R = (n) => Math.round(n * 100) / 100;

// ---------- tiny XML tokenizer (enough for these hand-written SVGs) ----------
function parseAttrs(s) {
  const a = {};
  for (const m of s.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) a[m[1]] = m[2];
  return a;
}
function parseXml(xml) {
  xml = xml.replace(/<\?xml[^>]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '')
           .replace(/<title>[\s\S]*?<\/title>/g, '').replace(/<metadata>[\s\S]*?<\/metadata>/g, '');
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  for (const m of xml.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, close, tag, rest, self] = m;
    if (close) { stack.pop(); continue; }
    const node = { tag, attrs: parseAttrs(rest), children: [] };
    stack[stack.length - 1].children.push(node);
    if (!self) stack.push(node);
  }
  return root.children.find((n) => n.tag === 'svg');
}

// ---------- 2D affine matrices [a b c d e f] ----------
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const applyVec = (m, [x, y]) => [m[0] * x + m[2] * y, m[1] * x + m[3] * y];
function parseTransform(t = '') {
  let m = I;
  for (const [, fn, args] of t.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === 'translate') m = mul(m, [1, 0, 0, 1, v[0], v[1] ?? 0]);
    else if (fn === 'scale') m = mul(m, [v[0], 0, 0, v[1] ?? v[0], 0, 0]);
    else if (fn === 'rotate') {
      const r = (v[0] * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      const cx = v[1] ?? 0, cy = v[2] ?? 0;
      m = mul(m, [1, 0, 0, 1, cx, cy]); m = mul(m, [c, s, -s, c, 0, 0]); m = mul(m, [1, 0, 0, 1, -cx, -cy]);
    } else if (fn === 'matrix') m = mul(m, v);
    else throw new Error(`unsupported transform ${fn}`);
  }
  return m;
}

// ---------- path data -> list of subpaths of cubic segments ----------
function arcToCubics(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  // SVG arc endpoint -> center parameterisation -> cubic beziers (<= 90deg each)
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
  const rad = (phi * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = fa === fs ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * yp * yp + ry * ry * xp * xp)));
  const cxp = (co * rx * yp) / ry, cyp = (-co * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  let t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9);
  const segs = [], d = dt / n, k = (4 / 3) * Math.tan(d / 4);
  const pt = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const der = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  for (let i = 0; i < n; i++) {
    const a = t1 + i * d, b = a + d;
    const p0 = pt(a), p3 = pt(b), d0 = der(a), d3 = der(b);
    segs.push([p0[0] + k * d0[0], p0[1] + k * d0[1], p3[0] - k * d3[0], p3[1] - k * d3[1], p3[0], p3[1]]);
  }
  return segs;
}

function parsePath(d) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) || [];
  const subs = []; let cur = null, i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
  const num = () => parseFloat(toks[i++]);
  const start = (nx, ny) => { cur = { start: [nx, ny], segs: [], closed: false }; subs.push(cur); x = sx = nx; y = sy = ny; };
  const cubic = (c1x, c1y, c2x, c2y, nx, ny) => { cur.segs.push([c1x, c1y, c2x, c2y, nx, ny]); x = nx; y = ny; };
  const line = (nx, ny) => cubic(x, y, nx, ny, nx, ny);
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { start(num() + ox, num() + oy); cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') line(num() + ox, num() + oy);
    else if (C === 'H') line(num() + ox, y);
    else if (C === 'V') line(x, num() + oy);
    else if (C === 'C') cubic(num() + ox, num() + oy, num() + ox, num() + oy, num() + ox, num() + oy);
    else if (C === 'Q') {
      const qx = num() + ox, qy = num() + oy, nx = num() + ox, ny = num() + oy;
      cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), nx + (2 / 3) * (qx - nx), ny + (2 / 3) * (qy - ny), nx, ny);
    } else if (C === 'A') {
      const rx = num(), ry = num(), phi = num(), fa = num(), fs = num(), nx = num() + ox, ny = num() + oy;
      for (const s of arcToCubics(x, y, rx, ry, phi, !!fa, !!fs, nx, ny)) cubic(...s);
    } else if (C === 'Z') { cur.closed = true; x = sx; y = sy; }
    else throw new Error(`unsupported path command ${cmd}`);
  }
  return subs;
}

const K = 0.5522847498;
function ellipseSubs(cx, cy, rx, ry) {
  return [{ start: [cx + rx, cy], closed: true, segs: [
    [cx + rx, cy + K * ry, cx + K * rx, cy + ry, cx, cy + ry],
    [cx - K * rx, cy + ry, cx - rx, cy + K * ry, cx - rx, cy],
    [cx - rx, cy - K * ry, cx - K * rx, cy - ry, cx, cy - ry],
    [cx + K * rx, cy - ry, cx + rx, cy - K * ry, cx + rx, cy],
  ] }];
}
function rectSubs(x, y, w, h) {
  const L = (a, b) => [a, b, a, b, a, b];
  return [{ start: [x, y], closed: true, segs: [L(x + w, y), L(x + w, y + h), L(x, y + h), L(x, y)] }];
}

// subpath (absolute cubics) + matrix -> Lottie bezier {i,o,v,c}
function toLottieShape(sub, m) {
  const v = [sub.start], ins = [[0, 0]], outs = [];
  for (const [c1x, c1y, c2x, c2y, px, py] of sub.segs) {
    const prev = v[v.length - 1];
    outs.push([c1x - prev[0], c1y - prev[1]]);
    v.push([px, py]); ins.push([c2x - px, c2y - py]);
  }
  outs.push([0, 0]);
  // a closed path that ends on its start point: merge the duplicate vertex
  const last = v.length - 1;
  if (sub.closed && last > 0 && Math.hypot(v[last][0] - v[0][0], v[last][1] - v[0][1]) < 0.01) {
    ins[0] = ins[last]; v.pop(); ins.pop(); outs.pop();
  }
  return {
    ty: 'sh',
    ks: { a: 0, k: {
      v: v.map((p) => apply(m, p).map(R)),
      i: ins.map((p) => applyVec(m, p).map(R)),
      o: outs.map((p) => applyVec(m, p).map(R)),
      c: !!sub.closed,
    } },
  };
}

function color(c) {
  if (!c || c === 'none') return null;
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`unsupported colour ${c}`);
  return [0, 2, 4].map((k) => R(parseInt(h.slice(k, k + 2), 16) / 255)).concat(1);
}
const LC = { butt: 1, round: 2, square: 3 }, LJ = { miter: 1, round: 2, bevel: 3 };
const TR = { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } };
let VIEW = null; // [w, h] of the canvas being converted
// Dark-mode outline: when set, every shape also gets a wider copy in this colour in a layer
// underneath, so dark ink reads on a dark background. { color: [r,g,b,1], w: extra width per side }
let OUTLINE = null, OUTLINED = null;
// Dark mode: when set, near-black ink is redrawn in this colour (accent colours stay).
let INK_TO = null;
// Bare poses: TRIM drops any shape that runs past the canvas edge rather than
// cutting it, and DROP lists boxes (canvas coords) whose shapes are left out,
// so a pose's hand lettering goes without clipping the figure.
let TRIM = false, DROP = [];
const INHERIT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule'];

// Walk one static frame's tree into Lottie groups (in SVG paint order).
function walk(node, m, style, out) {
  const a = node.attrs;
  if (a.visibility === 'hidden' || a.display === 'none') return;
  const st = { ...style };
  for (const k of INHERIT) if (a[k] != null) st[k] = a[k];
  st.opacity = (style.opacity ?? 1) * (a.opacity != null ? parseFloat(a.opacity) : 1);
  const mm = a.transform ? mul(m, parseTransform(a.transform)) : m;
  if (node.tag === 'g' || node.tag === 'svg') { for (const c of node.children) walk(c, mm, st, out); return; }
  let subs;
  if (node.tag === 'path') subs = parsePath(a.d || '');
  else if (node.tag === 'ellipse') subs = ellipseSubs(+a.cx || 0, +a.cy || 0, +a.rx, +a.ry);
  else if (node.tag === 'circle') subs = ellipseSubs(+a.cx || 0, +a.cy || 0, +a.r, +a.r);
  else if (node.tag === 'rect') {
    // A rect the size of the whole drawing is its paper (the lockups have one);
    // leave it out so the page's own background shows through.
    if (VIEW && +a.width >= VIEW[0] && +a.height >= VIEW[1]) return;
    subs = rectSubs(+a.x || 0, +a.y || 0, +a.width, +a.height);
  }
  else return; // animate etc.
  if (!subs.length) return;
  const items = subs.map((s) => toLottieShape(s, mm));
  // skip shapes that sit entirely outside the canvas (e.g. the other cells of poses.svg)
  if (VIEW) {
    const pad = parseFloat(st['stroke-width'] ?? 0) * 2 + 2;
    const pts = items.flatMap((it) => it.ks.k.v);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    if (Math.max(...xs) < -pad || Math.min(...xs) > VIEW[0] + pad || Math.max(...ys) < -pad || Math.min(...ys) > VIEW[1] + pad) return;
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (TRIM && (x0 < 0 || y0 < 0 || x1 > VIEW[0] || y1 > VIEW[1])) return;
    if (DROP.some(([a, b, c, d]) => x0 >= a && y0 >= b && x1 <= c && y1 <= d)) return;
  }
  const o = R(st.opacity * 100);
  const ink = (c) => (c && INK_TO && c[0] < 0.2 && c[1] < 0.2 && c[2] < 0.2 ? INK_TO : c);
  const strokeC = ink(color(st.stroke)), fillC = ink(color(st.fill ?? '#000000'));
  const scale = Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2]));
  if (strokeC && parseFloat(st['stroke-width'] ?? 1) > 0) items.push({
    ty: 'st', c: { a: 0, k: strokeC }, o: { a: 0, k: o }, w: { a: 0, k: R(parseFloat(st['stroke-width'] ?? 1) * scale) },
    lc: LC[st['stroke-linecap'] ?? 'butt'], lj: LJ[st['stroke-linejoin'] ?? 'miter'], ml: 4,
  });
  if (fillC) items.push({ ty: 'fl', c: { a: 0, k: fillC }, o: { a: 0, k: o }, r: st['fill-rule'] === 'evenodd' ? 2 : 1 });
  items.push(TR);
  out.push({ ty: 'gr', it: items });
  if (OUTLINE) {
    const base = strokeC ? parseFloat(st['stroke-width'] ?? 1) * scale : 0;
    OUTLINED.push({ ty: 'gr', it: [
      ...items.filter((it) => it.ty === 'sh'),
      { ty: 'st', c: { a: 0, k: OUTLINE.color }, o: { a: 0, k: o }, w: { a: 0, k: R(base + 2 * OUTLINE.w) }, lc: 2, lj: 2, ml: 4 },
      ...(fillC ? [{ ty: 'fl', c: { a: 0, k: OUTLINE.color }, o: { a: 0, k: o }, r: 1 }] : []),
      TR,
    ] });
  }
}

// ---------- frame splitting (same logic as build-mascots.mjs) ----------
const FRAME_START = /<g visibility="(?:visible|hidden)">\s*<animate attributeName="visibility"[^>]*\/>/g;
function matchClose(svg, start) {
  const tag = /<g\b[^>]*?(\/?)>|<\/g>/g; tag.lastIndex = start; let depth = 0, m;
  while ((m = tag.exec(svg))) {
    if (m[0].startsWith('</')) { if (--depth === 0) return tag.lastIndex; }
    else if (m[1] !== '/') depth++;
  }
  throw new Error('unbalanced <g>');
}
export function splitFrames(svg) {
  const spans = [...svg.matchAll(FRAME_START)].map((m) => ({ start: m.index, headEnd: m.index + m[0].length, end: matchClose(svg, m.index) }));
  if (!spans.length) return [svg];
  return spans.map((keep) => {
    let out = '', cur = 0;
    for (const s of spans) { out += svg.slice(cur, s.start); if (s === keep) out += '<g>' + svg.slice(s.headEnd, s.end); cur = s.end; }
    return out + svg.slice(cur);
  });
}

export function svgToLottie(svgText, name = 'mascot', viewBox, outline = null, inkTo = null, { trim = false, drop = [] } = {}) {
  const frames = splitFrames(svgText);
  let vb = (viewBox ?? parseXml(frames[0]).attrs.viewBox ?? '0 0 400 400').split(/[\s,]+/).map(Number);
  const [vx, vy, vw, vh] = vb;
  const base = [1, 0, 0, 1, -vx, -vy];
  VIEW = [vw, vh];
  TRIM = trim;
  DROP = drop.map(([x0, y0, x1, y1]) => [x0 - vx, y0 - vy, x1 - vx, y1 - vy]);
  // outline width scales with the canvas: 5 units on a 400 canvas, at least 2
  OUTLINE = outline ? { color: color(outline), w: Math.max(2, (5 * Math.min(vw, vh)) / 400) } : null;
  INK_TO = inkTo ? color(inkTo) : null;
  const KS = { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [0, 0, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] } };
  const layers = [];
  frames.forEach((f, idx) => {
    const svg = parseXml(f), shapes = [];
    OUTLINED = [];
    for (const c of svg.children) walk(c, base, {}, shapes);
    shapes.reverse(); // Lottie: first item is drawn on top
    const common = { ddd: 0, ty: 4, sr: 1, ao: 0, bm: 0, st: 0, ip: idx * HOLD, op: (idx + 1) * HOLD, ks: KS };
    layers.push({ ...common, ind: layers.length + 1, nm: `boil ${idx + 1}`, shapes });
    if (OUTLINE) layers.push({ ...common, ind: layers.length + 1, nm: `boil ${idx + 1} outline`, shapes: OUTLINED.reverse() });
  });
  OUTLINE = null; INK_TO = null; TRIM = false; DROP = [];
  return { v: '5.7.4', fr: FPS, ip: 0, op: frames.length * HOLD, w: Math.round(vw), h: Math.round(vh), nm: name, ddd: 0, assets: [], layers };
}

// poses.svg holds three 400x400 cells side by side. The `...Bare` poses leave
// out the cell's hand lettering, for screens that say it in their own words:
// - emptyBare: cropped below "no gigs yet" (above y 100 in both characters).
// - celebrateBare: "booked!" sits under the feet (figure ends by y 336, the
//   lettering runs below 347), so the cell is cut at 345 and the strokes that
//   cross it go whole.
// - nudgeBare: the lettering sits beside dez's head and over bunz's, so each
//   character's is boxed out (poses.svg coords) instead of cropped.
const POSES = [
  ['celebrate', '0 0 400 400'],
  ['celebrateBare', '0 0 400 345', { trim: true }],
  ['empty', '400 0 400 400'],
  ['emptyBare', '400 120 400 260'],
  ['nudge', '800 0 400 400'],
  ['nudgeBare', '800 40 400 340', { drop: { dez: [[805, 165, 910, 205]], bunz: [[840, 0, 1165, 72]] } }],
];

if (process.argv[1] && fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])) {
  const [SRC = 'assets/mascots/src', OUT = 'assets/mascots/lottie'] = process.argv.slice(2);
  const write = (rel, json) => {
    const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(json)); return fs.statSync(p).size;
  };
  let total = 0, count = 0;
  for (const name of fs.readdirSync(SRC)) {
    const dir = path.join(SRC, name);
    // a character is a folder with its poses; lockups/, lettering/ (scripts/month-lettering.mjs's)
    // and app-icon/ are not
    if (name === 'lockups' || !fs.statSync(dir).isDirectory() || !fs.existsSync(path.join(dir, 'poses.svg'))) continue;
    const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
    // each pose twice: as drawn (light backgrounds) and with the black ink drawn in white (dark mode)
    for (const [suffix, inkTo] of [['', null], ['-dark', '#FFFFFF']]) {
      total += write(`${name}/hero${suffix}.json`, svgToLottie(read('hero.svg'), `${name} hero`, undefined, null, inkTo)); count++;
      total += write(`${name}/icon${suffix}.json`, svgToLottie(read('small.svg'), `${name} icon`, undefined, null, inkTo)); count++;
      for (const [pose, view, { trim, drop } = {}] of POSES) {
        total += write(`${name}/${pose}${suffix}.json`, svgToLottie(read('poses.svg'), `${name} ${pose}`, view, null, inkTo, { trim, drop: drop?.[name] }));
        count++;
      }
    }
  }
  const lock = path.join(SRC, 'lockups');
  if (fs.existsSync(lock)) for (const name of fs.readdirSync(lock)) for (const f of fs.readdirSync(path.join(lock, name)).filter((f) => f.endsWith('.svg'))) {
    total += write(`lockups/${name}/${f.replace('.svg', '.json')}`, svgToLottie(fs.readFileSync(path.join(lock, name, f), 'utf8'), `${name} ${f}`)); count++;
  }
  // index.ts with static require()s, so Metro bundles each file and the component can look them up
  const entries = {};
  for (const name of fs.readdirSync(OUT)) {
    const dir = path.join(OUT, name);
    // lettering/ is scripts/month-lettering.mjs's, with its own index
    if (name === 'lockups' || name === 'lettering' || !fs.statSync(dir).isDirectory()) continue;
    entries[name] = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => [f.replace('.json', '').replace(/-(\w)/g, (_, c) => c.toUpperCase()), `./${name}/${f}`]);
  }
  const lockOut = path.join(OUT, 'lockups');
  if (fs.existsSync(lockOut)) for (const name of fs.readdirSync(lockOut)) {
    const camel = (f) => f.replace('.json', '').replace(/^\d+-/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase());
    (entries[name] ??= []).push(...fs.readdirSync(path.join(lockOut, name)).map((f) => [camel(f), `./lockups/${name}/${f}`]));
  }
  const body = Object.entries(entries).map(([n, list]) =>
    `  ${n}: {\n${list.map(([k, p]) => `    ${k}: require('${p}'),`).join('\n')}\n  },`).join('\n');
  fs.writeFileSync(path.join(OUT, 'index.ts'),
    '// AUTO-GENERATED by scripts/svg-to-lottie.mjs. Do not edit.\n' +
    `export const MASCOT_LOTTIE = {\n${body}\n} as const;\n` +
    'export type MascotName = keyof typeof MASCOT_LOTTIE;\n' +
    'export type MascotPose<N extends MascotName> = keyof (typeof MASCOT_LOTTIE)[N];\n');
  console.log(`wrote ${count} Lottie files + index.ts to ${OUT} (${(total / 1024).toFixed(0)} KB total)`);
}
