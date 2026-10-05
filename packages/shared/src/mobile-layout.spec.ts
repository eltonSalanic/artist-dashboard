import { updateMobileLayoutSchema } from './dto/mobile-layout.dto';
import { DEFAULT_BOARD_LAYOUT, mergeLayouts, type LayoutItem } from './layout';
import {
  mergeMobileLayout,
  mobileLayoutFromWeb,
  packMobileGrid,
  stretchLoneCards,
  type MobileLayoutItem,
  type MobilePlacement,
} from './mobile-layout';

const at = (widgetType: LayoutItem['widgetType'], y: number, x: number, hidden?: boolean): LayoutItem => ({
  widgetType,
  x,
  y,
  w: 4,
  h: 4,
  ...(hidden ? { hidden } : {}),
});

const card = (
  widgetType: MobileLayoutItem['widgetType'],
  w: MobileLayoutItem['w'] = 1,
  h: MobileLayoutItem['h'] = 1,
  hidden?: boolean,
): MobileLayoutItem => ({ widgetType, w, h, ...(hidden ? { hidden } : {}) });

const types = (items: { widgetType: string }[]) => items.map((item) => item.widgetType);

describe('mobileLayoutFromWeb', () => {
  it('follows web in reading order: top to bottom, then left to right', () => {
    const web = [at('FOCUS', 8, 0), at('TODOS', 0, 4), at('GOALS', 0, 0)];
    expect(types(mobileLayoutFromWeb(web))).toEqual(['GOALS', 'TODOS', 'FOCUS']);
  });

  // The arrangement that prompted P12b, as it was stored: Shows dragged to
  // web's top-left over the shipped default must come first on the phone.
  it('puts a widget dragged to the top-left on web first', () => {
    const saved: LayoutItem[] = [
      { widgetType: 'SHOWS', x: 0, y: 0, w: 4, h: 4 },
      { widgetType: 'MY_TASKS', x: 4, y: 0, w: 4, h: 6 },
      { widgetType: 'TODOS', x: 0, y: 6, w: 8, h: 6 },
      { widgetType: 'FOCUS', x: 0, y: 12, w: 12, h: 3 },
    ];
    const web = mergeLayouts(DEFAULT_BOARD_LAYOUT, saved);
    expect(mobileLayoutFromWeb(web)[0].widgetType).toBe('SHOWS');
  });

  it('gives prose and long lists both columns, and counts one; all one row tall', () => {
    const sizes = Object.fromEntries(
      mobileLayoutFromWeb(DEFAULT_BOARD_LAYOUT).map((item) => [item.widgetType, [item.w, item.h]]),
    );
    expect(sizes).toMatchObject({
      FOCUS: [2, 1],
      CUSTOM: [2, 1],
      TODOS: [2, 1],
      ACTIVITY_FEED: [2, 1],
      SHOWS: [1, 1],
      GOALS: [1, 1],
    });
  });

  it("keeps web's hidden widgets hidden", () => {
    const items = mobileLayoutFromWeb([at('GOALS', 0, 0, true), at('SHOWS', 0, 4)]);
    expect(items).toEqual([card('GOALS', 1, 1, true), card('SHOWS')]);
  });

  it('never offers the calendar tab as a card', () => {
    expect(types(mobileLayoutFromWeb([at('CALENDAR', 0, 0), at('SHOWS', 0, 4)]))).toEqual(['SHOWS']);
  });
});

describe('mergeMobileLayout', () => {
  const web = [at('GOALS', 0, 0), at('SHOWS', 0, 4), at('REMINDERS', 4, 0)];

  it('keeps the order, widths and hidden flags the person saved', () => {
    const saved = [card('REMINDERS', 2, 2), card('SHOWS', 1, 1, true), card('GOALS', 2)];
    expect(mergeMobileLayout(saved, web)).toEqual(saved);
  });

  it('adds widgets the board gained since the save at the end, as web shows them', () => {
    const saved = [card('SHOWS', 2)];
    const withHidden = [...web.slice(0, 2), at('REMINDERS', 4, 0, true)];
    expect(mergeMobileLayout(saved, withHidden)).toEqual([
      card('SHOWS', 2),
      card('GOALS'),
      card('REMINDERS', 1, 1, true),
    ]);
  });

  it('drops widgets the board no longer has', () => {
    const saved = [card('MY_TASKS'), card('SHOWS'), card('GOALS'), card('REMINDERS')];
    expect(types(mergeMobileLayout(saved, web))).toEqual(['SHOWS', 'GOALS', 'REMINDERS']);
  });
});

describe('packMobileGrid', () => {
  const at2 = (p: MobilePlacement) => `${p.widgetType}@${p.row},${p.col} ${p.w}x${p.h}`;
  const pack = (items: MobileLayoutItem[]) => packMobileGrid(items).placements.map(at2);

  it('flows one-column cards two to a row, in order', () => {
    expect(pack([card('GOALS'), card('SHOWS'), card('REMINDERS')])).toEqual([
      'GOALS@0,0 1x1',
      'SHOWS@0,1 1x1',
      'REMINDERS@1,0 1x1',
    ]);
  });

  it('gives a two-column card a row of its own', () => {
    expect(pack([card('FOCUS', 2), card('GOALS'), card('SHOWS')])).toEqual([
      'FOCUS@0,0 2x1',
      'GOALS@1,0 1x1',
      'SHOWS@1,1 1x1',
    ]);
  });

  it('stacks small cards beside a tall one', () => {
    expect(pack([card('TODOS', 1, 2), card('GOALS'), card('SHOWS'), card('REMINDERS')])).toEqual([
      'TODOS@0,0 1x2',
      'GOALS@0,1 1x1',
      'SHOWS@1,1 1x1',
      'REMINDERS@2,0 1x1',
    ]);
  });

  // Auto-fill: a small card later in the order fills the hole a wide card
  // left, as a phone's home screen does.
  it('fills a hole with a later card that fits', () => {
    expect(pack([card('GOALS'), card('FOCUS', 2), card('SHOWS')])).toEqual([
      'GOALS@0,0 1x1',
      'FOCUS@1,0 2x1',
      'SHOWS@0,1 1x1',
    ]);
  });

  it('places a 2x2 card and counts the rows used', () => {
    const { placements, rows } = packMobileGrid([card('TODOS', 2, 2), card('GOALS')]);
    expect(placements.map(at2)).toEqual(['TODOS@0,0 2x2', 'GOALS@2,0 1x1']);
    expect(rows).toBe(3);
  });

  it('leaves hidden cards out', () => {
    expect(pack([card('GOALS', 1, 1, true), card('SHOWS')])).toEqual(['SHOWS@0,0 1x1']);
  });

  it('never overlaps two cards', () => {
    const items = [
      card('TODOS', 1, 2), card('FOCUS', 2), card('GOALS', 2, 2), card('SHOWS'),
      card('REMINDERS', 1, 2), card('MY_TASKS'), card('CUSTOM', 2), card('NEXT_MEETINGS'),
    ];
    const cells = new Set<string>();
    for (const p of packMobileGrid(items).placements) {
      for (let r = p.row; r < p.row + p.h; r++) {
        for (let c = p.col; c < p.col + p.w; c++) {
          expect(c).toBeLessThan(2);
          expect(cells.has(`${r},${c}`)).toBe(false);
          cells.add(`${r},${c}`);
        }
      }
    }
  });
});

describe('stretchLoneCards', () => {
  const stretch = (items: MobileLayoutItem[]) =>
    stretchLoneCards(packMobileGrid(items).placements).map((p) => `${p.widgetType} ${p.col}:${p.w}`);

  it('draws a one-column card with nothing beside it across both columns', () => {
    expect(stretch([card('FOCUS', 2), card('GOALS')])).toEqual(['FOCUS 0:2', 'GOALS 0:2']);
  });

  it('leaves a card with a neighbour alone', () => {
    expect(stretch([card('GOALS'), card('SHOWS')])).toEqual(['GOALS 0:1', 'SHOWS 1:1']);
  });

  it('stretches a tall card only if nothing is beside it for its whole height', () => {
    expect(stretch([card('TODOS', 1, 2), card('GOALS')])).toEqual(['TODOS 0:1', 'GOALS 1:1']);
    expect(stretch([card('TODOS', 1, 2)])).toEqual(['TODOS 0:2']);
  });
});

describe('updateMobileLayoutSchema', () => {
  const parse = (items: unknown) => updateMobileLayoutSchema.safeParse({ items });

  it('accepts an arrangement', () => {
    expect(parse([card('SHOWS'), card('FOCUS', 2, 2, true)]).success).toBe(true);
  });

  it('refuses a widget twice', () => {
    expect(parse([card('SHOWS'), card('SHOWS', 2)]).success).toBe(false);
  });

  it('refuses the calendar tab', () => {
    expect(parse([card('SHOWS'), { widgetType: 'CALENDAR', w: 1, h: 1 }]).success).toBe(false);
  });

  it('refuses an arrangement with nothing shown', () => {
    expect(parse([card('SHOWS', 1, 1, true)]).success).toBe(false);
  });

  it('refuses a card bigger than 2x2', () => {
    expect(parse([{ widgetType: 'SHOWS', w: 3, h: 1 }]).success).toBe(false);
    expect(parse([{ widgetType: 'SHOWS', w: 1, h: 3 }]).success).toBe(false);
  });

  // The P12b first draft stored a full/half `size`; rows saved by it must be
  // refused so the API falls back to following web instead of serving junk.
  it('refuses the old full/half shape', () => {
    expect(parse([{ widgetType: 'SHOWS', size: 'half' }]).success).toBe(false);
  });
});
