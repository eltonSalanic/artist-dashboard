import { updateMobileLayoutSchema } from './dto/mobile-layout.dto';
import { DEFAULT_BOARD_LAYOUT, mergeLayouts, type LayoutItem } from './layout';
import {
  mergeMobileLayout,
  mobileLayoutFromWeb,
  mobileRows,
  type MobileLayoutItem,
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
  size: MobileLayoutItem['size'],
  hidden?: boolean,
): MobileLayoutItem => ({ widgetType, size, ...(hidden ? { hidden } : {}) });

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

  it('gives prose and long lists the full width, and counts half', () => {
    const sizes = Object.fromEntries(
      mobileLayoutFromWeb(DEFAULT_BOARD_LAYOUT).map((item) => [item.widgetType, item.size]),
    );
    expect(sizes).toMatchObject({
      FOCUS: 'full',
      CUSTOM: 'full',
      TODOS: 'full',
      ACTIVITY_FEED: 'full',
      SHOWS: 'half',
      GOALS: 'half',
    });
  });

  it("keeps web's hidden widgets hidden", () => {
    const items = mobileLayoutFromWeb([at('GOALS', 0, 0, true), at('SHOWS', 0, 4)]);
    expect(items).toEqual([card('GOALS', 'half', true), card('SHOWS', 'half')]);
  });

  it('never offers the calendar tab as a card', () => {
    expect(types(mobileLayoutFromWeb([at('CALENDAR', 0, 0), at('SHOWS', 0, 4)]))).toEqual(['SHOWS']);
  });
});

describe('mergeMobileLayout', () => {
  const web = [at('GOALS', 0, 0), at('SHOWS', 0, 4), at('REMINDERS', 4, 0)];

  it('keeps the order, widths and hidden flags the person saved', () => {
    const saved = [card('REMINDERS', 'full'), card('SHOWS', 'half', true), card('GOALS', 'full')];
    expect(mergeMobileLayout(saved, web)).toEqual(saved);
  });

  it('adds widgets the board gained since the save at the end, as web shows them', () => {
    const saved = [card('SHOWS', 'full')];
    const withHidden = [...web.slice(0, 2), at('REMINDERS', 4, 0, true)];
    expect(mergeMobileLayout(saved, withHidden)).toEqual([
      card('SHOWS', 'full'),
      card('GOALS', 'half'),
      card('REMINDERS', 'half', true),
    ]);
  });

  it('drops widgets the board no longer has', () => {
    const saved = [card('MY_TASKS', 'half'), card('SHOWS', 'half'), card('GOALS', 'half'), card('REMINDERS', 'half')];
    expect(types(mergeMobileLayout(saved, web))).toEqual(['SHOWS', 'GOALS', 'REMINDERS']);
  });
});

describe('mobileRows', () => {
  const rows = (items: MobileLayoutItem[]) => mobileRows(items).map(types);

  it('pairs half cards two to a row', () => {
    expect(rows([card('GOALS', 'half'), card('SHOWS', 'half'), card('REMINDERS', 'half'), card('MY_TASKS', 'half')])).toEqual([
      ['GOALS', 'SHOWS'],
      ['REMINDERS', 'MY_TASKS'],
    ]);
  });

  it('gives a full card its own row', () => {
    expect(rows([card('FOCUS', 'full'), card('GOALS', 'half'), card('SHOWS', 'half')])).toEqual([
      ['FOCUS'],
      ['GOALS', 'SHOWS'],
    ]);
  });

  // A half card with no half partner stretches rather than leaving a gap, and
  // the next half card is never pulled up out of order to fill it.
  it('lets a half card before a full one stand alone, keeping the order', () => {
    expect(rows([card('GOALS', 'half'), card('FOCUS', 'full'), card('SHOWS', 'half'), card('REMINDERS', 'half')])).toEqual([
      ['GOALS'],
      ['FOCUS'],
      ['SHOWS', 'REMINDERS'],
    ]);
  });

  it('lets a trailing half card stand alone', () => {
    expect(rows([card('GOALS', 'half'), card('SHOWS', 'half'), card('REMINDERS', 'half')])).toEqual([
      ['GOALS', 'SHOWS'],
      ['REMINDERS'],
    ]);
  });

  it('leaves hidden cards out before pairing', () => {
    expect(rows([card('GOALS', 'half'), card('FOCUS', 'full', true), card('SHOWS', 'half')])).toEqual([
      ['GOALS', 'SHOWS'],
    ]);
  });
});

describe('updateMobileLayoutSchema', () => {
  const parse = (items: unknown) => updateMobileLayoutSchema.safeParse({ items });

  it('accepts an arrangement', () => {
    expect(parse([card('SHOWS', 'half'), card('FOCUS', 'full', true)]).success).toBe(true);
  });

  it('refuses a widget twice', () => {
    expect(parse([card('SHOWS', 'half'), card('SHOWS', 'full')]).success).toBe(false);
  });

  it('refuses the calendar tab', () => {
    expect(parse([card('SHOWS', 'half'), { widgetType: 'CALENDAR', size: 'full' }]).success).toBe(false);
  });

  it('refuses an arrangement with nothing shown', () => {
    expect(parse([card('SHOWS', 'half', true)]).success).toBe(false);
  });

  it('refuses a size other than full or half', () => {
    expect(parse([{ widgetType: 'SHOWS', size: 'third' }]).success).toBe(false);
  });
});
