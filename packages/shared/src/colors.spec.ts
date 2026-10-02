import { fitToSrgb, isInSrgbGamut, oklchCss, oklchToHex } from './colors';

describe('oklchToHex', () => {
  // The three sRGB primaries and the greys, as OKLCH. These are the published
  // reference values, so they pin the matrices rather than the code's own
  // output — a transposed coefficient fails here instead of looking plausible.
  it.each([
    ['black', { l: 0, c: 0, h: 0 }, '#000000'],
    ['white', { l: 1, c: 0, h: 0 }, '#ffffff'],
    ['red', { l: 0.627955, c: 0.257683, h: 29.2338 }, '#ff0000'],
    ['green', { l: 0.86644, c: 0.294827, h: 142.4953 }, '#00ff00'],
    ['blue', { l: 0.452014, c: 0.313214, h: 264.052 }, '#0000ff'],
  ])('converts %s', (_name, color, expected) => {
    expect(oklchToHex(color)).toBe(expected);
  });

  it('renders mid grey as an equal-channel hex', () => {
    const hex = oklchToHex({ l: 0.5, c: 0, h: 0 });
    expect(hex).toMatch(/^#([0-9a-f]{2})\1\1$/);
  });

  it('appends an alpha byte only when alpha is given', () => {
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe('#ffffff');
    expect(oklchToHex({ l: 1, c: 0, h: 0, alpha: 1 })).toBe('#ffffffff');
    expect(oklchToHex({ l: 1, c: 0, h: 0, alpha: 0.12 })).toBe('#ffffff1f');
    expect(oklchToHex({ l: 1, c: 0, h: 0, alpha: 0 })).toBe('#ffffff00');
  });

  it('maps an out-of-gamut colour by dropping chroma, not by clipping', () => {
    // Chroma far past what sRGB can hold at this lightness. Clipping would pin
    // red and blue at 00 and shift the hue; chroma reduction keeps the hue and
    // lands on a duller green of the same lightness.
    const vivid = { l: 0.5, c: 0.4, h: 150 };
    const fitted = fitToSrgb(vivid);

    expect(fitted.l).toBe(vivid.l);
    expect(fitted.h).toBe(vivid.h);
    expect(fitted.c).toBeLessThan(vivid.c);
    expect(isInSrgbGamut(fitted)).toBe(true);

    // Clipping this would give #009100 — a pure green. Reducing chroma keeps
    // the authored hue, which at 150° is green with a blue lean.
    expect(oklchToHex(vivid)).toBe('#007835');
  });

  it('leaves an in-gamut colour untouched', () => {
    const color = { l: 0.84, c: 0.13, h: 78 };
    expect(fitToSrgb(color)).toBe(color);
  });

  it('barely moves the real out-of-gamut palette values', () => {
    // ocean c2 is the worst offender in the palettes and still lands within
    // 1-3 of the clipped result, because gamma encoding swallows the overshoot.
    // Recorded so the gamut work is not mistaken for a visible fix.
    expect(oklchToHex({ l: 0.55, c: 0.1, h: 205 })).toBe('#00818c');
    expect(oklchToHex({ l: 0.52, c: 0.1, h: 205 })).toBe('#007781');
    expect(oklchToHex({ l: 0.26, c: 0.07, h: 122 })).toBe('#1f2800');
  });

  it('is stable across the hue circle', () => {
    for (const h of [0, 90, 180, 270, 360]) {
      expect(oklchToHex({ l: 0.6, c: 0.1, h })).toMatch(/^#[0-9a-f]{6}$/);
    }
    // 0° and 360° are the same hue.
    expect(oklchToHex({ l: 0.6, c: 0.1, h: 0 })).toBe(
      oklchToHex({ l: 0.6, c: 0.1, h: 360 }),
    );
  });
});

describe('isInSrgbGamut', () => {
  it('accepts the greys and a muted colour', () => {
    expect(isInSrgbGamut({ l: 0, c: 0, h: 0 })).toBe(true);
    expect(isInSrgbGamut({ l: 1, c: 0, h: 0 })).toBe(true);
    expect(isInSrgbGamut({ l: 0.84, c: 0.13, h: 78 })).toBe(true);
  });

  it('rejects a chroma sRGB cannot hold', () => {
    expect(isInSrgbGamut({ l: 0.5, c: 0.4, h: 150 })).toBe(false);
  });
});

describe('oklchCss', () => {
  it('writes the CSS form the web app already uses', () => {
    expect(oklchCss({ l: 0.84, c: 0.13, h: 78 })).toBe('oklch(0.84 0.13 78)');
  });

  it('drops trailing zeroes so generated CSS reads like the hand-written kind', () => {
    expect(oklchCss({ l: 0.9, c: 0.008, h: 80 })).toBe('oklch(0.9 0.008 80)');
    expect(oklchCss({ l: 1, c: 0, h: 0 })).toBe('oklch(1 0 0)');
  });

  it('uses the slash form for alpha', () => {
    expect(oklchCss({ l: 1, c: 0, h: 0, alpha: 0.12 })).toBe(
      'oklch(1 0 0 / 0.12)',
    );
  });
});
