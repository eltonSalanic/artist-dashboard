import { fitToSrgb, isInSrgbGamut, oklchToHex, type Oklch } from './colors';
import {
  BOARD_PALETTE_COLORS,
  BRAND_ACCENTS,
  SLOT_ALPHAS,
  SURFACE_TOKENS,
  slotTokens,
  type ColorScheme,
} from './palettes';
import { BOARD_PALETTES, BoardPalettes, WidgetColors } from './theme';

const schemes: ColorScheme[] = ['light', 'dark'];

describe('palette tables', () => {
  it('covers every palette the picker offers', () => {
    expect(Object.keys(BOARD_PALETTE_COLORS).sort()).toEqual(
      [...BoardPalettes].sort(),
    );
  });

  it('fills every slot the metadata promises', () => {
    for (const info of BOARD_PALETTES) {
      for (const scheme of schemes) {
        const slots = BOARD_PALETTE_COLORS[info.id][scheme];
        expect(Object.keys(slots).sort()).toEqual(
          info.slots.map((s) => s.key).sort(),
        );
      }
    }
  });

  it('describes exactly the non-base widget colours', () => {
    const slotKeys = WidgetColors.filter((c) => c !== 'base');
    for (const palette of BoardPalettes) {
      expect(Object.keys(BOARD_PALETTE_COLORS[palette].light).sort()).toEqual(
        [...slotKeys].sort(),
      );
    }
  });

  it('builds playful out of the brand accents, not copies of them', () => {
    // If someone retunes coral, the playful palette has to move with it.
    for (const scheme of schemes) {
      expect(BOARD_PALETTE_COLORS.playful[scheme].c1).toBe(
        BRAND_ACCENTS[scheme].coral,
      );
      expect(BOARD_PALETTE_COLORS.playful[scheme].c4).toBe(
        BRAND_ACCENTS[scheme].ink,
      );
    }
  });
});

describe('the values are renderable', () => {
  const every = (): [string, Oklch][] => {
    const out: [string, Oklch][] = [];
    for (const scheme of schemes) {
      for (const [name, value] of Object.entries(SURFACE_TOKENS[scheme])) {
        out.push([`${scheme}.${name}`, value]);
      }
      for (const palette of BoardPalettes) {
        for (const [slot, pair] of Object.entries(
          BOARD_PALETTE_COLORS[palette][scheme],
        )) {
          out.push([`${palette}.${scheme}.${slot}.bg`, pair.bg]);
          out.push([`${palette}.${scheme}.${slot}.fg`, pair.fg]);
        }
      }
    }
    return out;
  };

  // The whole point of lifting these out of CSS is that React Native can use
  // them, and RN only takes hex.
  it('converts every value to a hex colour', () => {
    for (const [name, value] of every()) {
      expect(oklchToHex(value)).toMatch(
        value.alpha === undefined ? /^#[0-9a-f]{6}$/ : /^#[0-9a-f]{8}$/,
      );
      expect(name).toBeTruthy();
    }
  });

  // Three authored colours sit outside sRGB. That is fine — both platforms
  // gamut-map them the same way — but the list is pinned here so a *new* one
  // is a decision someone makes rather than a surprise.
  it('maps exactly the three known out-of-gamut values', () => {
    const outside = every()
      .filter(([, value]) => !isInSrgbGamut(value))
      .map(([name]) => name)
      .sort();
    expect(outside).toEqual([
      'ocean.dark.c2.bg',
      'ocean.light.c2.bg',
      'playful.dark.c3.fg',
    ]);
  });

  it('maps them by dropping chroma only, so the hue survives', () => {
    for (const [, value] of every().filter(([, v]) => !isInSrgbGamut(v))) {
      const fitted = fitToSrgb(value);
      expect(fitted.l).toBe(value.l);
      expect(fitted.h).toBe(value.h);
      expect(fitted.c).toBeLessThan(value.c);
    }
  });

  it('keeps enough contrast between each slot and its foreground', () => {
    for (const scheme of schemes) {
      for (const palette of BoardPalettes) {
        for (const [slot, pair] of Object.entries(
          BOARD_PALETTE_COLORS[palette][scheme],
        )) {
          // OKLCH lightness is perceptual, so the gap is a usable proxy for
          // "text on this card is readable" without a full WCAG computation.
          const gap = Math.abs(pair.bg.l - pair.fg.l);
          expect({ palette, scheme, slot, gap: gap > 0.3 }).toEqual({
            palette,
            scheme,
            slot,
            gap: true,
          });
        }
      }
    }
  });
});

describe('slotTokens', () => {
  const slot = BOARD_PALETTE_COLORS.ocean.light.c2;
  const tokens = slotTokens(slot, SURFACE_TOKENS.light);

  it('paints the card with the slot and its text with the slot foreground', () => {
    expect(tokens.card).toEqual(slot.bg);
    expect(tokens.cardForeground).toEqual(slot.fg);
    expect(tokens.foreground).toEqual(slot.fg);
  });

  it('inverts primary, so a button on a coloured card is readable', () => {
    expect(tokens.primary).toEqual(slot.fg);
    expect(tokens.primaryForeground).toEqual(slot.bg);
  });

  it('derives the quiet tokens as the foreground at an alpha', () => {
    expect(tokens.mutedForeground).toEqual({
      ...slot.fg,
      alpha: SLOT_ALPHAS.mutedForeground,
    });
    expect(tokens.border).toEqual({ ...slot.fg, alpha: SLOT_ALPHAS.border });
    expect(tokens.ring).toEqual({ ...slot.fg, alpha: SLOT_ALPHAS.ring });
  });

  it('leaves the page and the destructive colour alone', () => {
    // A card does not own the canvas behind it, and a delete button should look
    // like a delete button on every card.
    expect(tokens.background).toEqual(SURFACE_TOKENS.light.background);
    expect(tokens.popover).toEqual(SURFACE_TOKENS.light.popover);
    expect(tokens.destructive).toEqual(SURFACE_TOKENS.light.destructive);
  });

  it('does not mutate the base token set it was given', () => {
    const base = SURFACE_TOKENS.dark;
    const before = JSON.stringify(base);
    slotTokens(BOARD_PALETTE_COLORS.mono.dark.c4, base);
    expect(JSON.stringify(base)).toBe(before);
  });
});
