import { BoardPalettes, WidgetColors } from '@artist/shared';
import { contrast, posterCanvas, posterSlot } from './poster-colors';

/**
 * The Wrapped screens write on solid colour, so legibility is a property of
 * every (palette × scheme × slot) pair, not of one design. Checked here rather
 * than by eye: 5 palettes × 2 schemes × 5 slots is 50 blocks.
 */
describe('poster colours', () => {
  const schemes = ['light', 'dark'] as const;

  for (const scheme of schemes) {
    it(`canvas text is legible in ${scheme}`, () => {
      const canvas = posterCanvas(scheme);
      expect(contrast(canvas.ink, canvas.background)).toBeGreaterThanOrEqual(7);
      expect(contrast(canvas.soft, canvas.background)).toBeGreaterThanOrEqual(4.5);
    });

    for (const palette of BoardPalettes) {
      for (const slot of WidgetColors) {
        it(`${palette} ${slot} in ${scheme}: ink ≥ 6, soft ≥ 4.5, accent ≥ 3`, () => {
          const block = posterSlot(palette, scheme, slot);
          expect(contrast(block.ink, block.bg)).toBeGreaterThanOrEqual(6);
          expect(contrast(block.soft, block.bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(block.accent, block.bg)).toBeGreaterThanOrEqual(3);
        });
      }
    }
  }

  it('prints the table', () => {
    if (!(process.env as Record<string, string | undefined>).POSTER_TABLE) return;
    for (const scheme of schemes)
      for (const palette of BoardPalettes)
        for (const slot of WidgetColors) {
          const b = posterSlot(palette, scheme, slot);
          console.log(
            `${scheme} ${palette} ${slot} bg=${b.bg} ink=${b.ink} accent=${b.accent} ` +
              `ink=${contrast(b.ink, b.bg).toFixed(1)} soft=${contrast(b.soft, b.bg).toFixed(1)} acc=${contrast(b.accent, b.bg).toFixed(1)}`,
          );
        }
  });

  it('composites alpha before measuring', () => {
    // 50% black on white is mid grey, nowhere near black's 21:1.
    expect(contrast('#00000080', '#ffffff')).toBeLessThan(5);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
});
