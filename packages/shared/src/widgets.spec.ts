import { WidgetTypes } from './enums';
import { WidgetColors } from './theme';
import { CARD_WIDGET_TYPES, WIDGET_META } from './widgets';

describe('WIDGET_META', () => {
  it('names every widget type, so a new one cannot ship untitled', () => {
    expect(Object.keys(WIDGET_META).sort()).toEqual([...WidgetTypes].sort());
    for (const meta of Object.values(WIDGET_META)) {
      expect(meta.title.trim()).not.toBe('');
    }
  });

  it('only assigns slots the palettes actually define', () => {
    for (const [type, meta] of Object.entries(WIDGET_META)) {
      if (meta.defaultColor === undefined) continue;
      expect({ type, known: WidgetColors.includes(meta.defaultColor) }).toEqual({
        type,
        known: true,
      });
    }
  });

  // The four coloured slots are spread across four different widgets on
  // purpose: the alternation is what gives the grid its rhythm.
  it('spends each palette slot on at most one widget', () => {
    const used = Object.values(WIDGET_META)
      .map((m) => m.defaultColor)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    expect(new Set(used).size).toBe(used.length);
  });

  it('leaves CALENDAR out of the card widgets — it is a page', () => {
    expect(CARD_WIDGET_TYPES).not.toContain('CALENDAR');
    expect(CARD_WIDGET_TYPES).toHaveLength(WidgetTypes.length - 1);
  });
});
