import type { WidgetType } from './enums';
import { readingOrder, type LayoutItem } from './layout';

/**
 * The phone's own arrangement of a board's widgets: an ordered list of cards,
 * each 1 or 2 columns wide and 1 or 2 rows tall, each shown or hidden.
 *
 * Web's layout is a freeform 12-column grid and a phone has two columns, so
 * the phone does not borrow web's positions. It stores an *order*, and
 * `packMobileGrid` flows the cards into the grid the way a phone's home screen
 * does. Until someone saves an arrangement on the phone it *follows* web
 * (`mobileLayoutFromWeb`); after that the two never move each other.
 */
export const MobileSpans = [1, 2] as const;
export type MobileSpan = (typeof MobileSpans)[number];

/** Every widget but the Calendar, which is a tab on the phone, never a card. */
export type CardWidgetType = Exclude<WidgetType, 'CALENDAR'>;

// A type alias, not an interface: an alias is assignable to the Prisma `Json`
// the API stores it as, an interface is not.
export type MobileLayoutItem = {
  widgetType: CardWidgetType;
  w: MobileSpan;
  h: MobileSpan;
  hidden?: boolean;
};

/** Where a phone arrangement came from: derived from web, or saved on a phone. */
export type MobileLayoutSource = 'web' | 'phone';

export interface MobileLayoutResponse {
  items: MobileLayoutItem[];
  source: MobileLayoutSource;
}

/** Prose and long lists read badly at half width; counts sit two-up. */
const WIDE_BY_DEFAULT: readonly WidgetType[] = ['FOCUS', 'CUSTOM', 'TODOS', 'ACTIVITY_FEED'];

export function defaultMobileSpan(widgetType: WidgetType): { w: MobileSpan; h: MobileSpan } {
  return { w: WIDE_BY_DEFAULT.includes(widgetType) ? 2 : 1, h: 1 };
}

/** A tab, not a widget: it is in web's layout but never a card. */
const isCard = (item: LayoutItem): item is LayoutItem & { widgetType: CardWidgetType } =>
  item.widgetType !== 'CALENDAR';

/**
 * A phone arrangement that follows web: web's reading order (top to bottom,
 * then left to right), default sizes, and web's hidden widgets.
 *
 * `web` is the merged layout `GET /layout` serves, so a member who has not
 * arranged anything gets the band's default through it.
 */
export function mobileLayoutFromWeb(web: LayoutItem[]): MobileLayoutItem[] {
  return readingOrder(web)
    .filter(isCard)
    .map((item): MobileLayoutItem => ({
      widgetType: item.widgetType,
      ...defaultMobileSpan(item.widgetType),
      ...(item.hidden ? { hidden: true } : {}),
    }));
}

/**
 * A saved phone arrangement, brought up to date with the widgets the board has
 * now. Widgets the board no longer has drop out; widgets it gained since the
 * save are added at the end, in web's order and as web shows them. Everything
 * the person chose (order, sizes, hidden) is kept.
 */
export function mergeMobileLayout(
  saved: MobileLayoutItem[],
  web: LayoutItem[],
): MobileLayoutItem[] {
  const fromWeb = mobileLayoutFromWeb(web);
  const current = new Set(fromWeb.map((item) => item.widgetType));
  const kept = saved.filter((item) => current.has(item.widgetType));
  const known = new Set(kept.map((item) => item.widgetType));
  return [...kept, ...fromWeb.filter((item) => !known.has(item.widgetType))];
}

export const MOBILE_COLUMNS = 2;

/** Where one card lands in the phone's grid, in cells. */
export type MobilePlacement = {
  widgetType: CardWidgetType;
  col: number;
  row: number;
  w: MobileSpan;
  h: MobileSpan;
};

/**
 * Flow the shown cards into the two-column grid in order, each into the first
 * free spot it fits, top to bottom then left to right, the way a phone's home
 * screen does. A later small card can fill a hole an earlier wide one left,
 * so the grid has holes only where nothing after could fit.
 */
export function packMobileGrid(items: MobileLayoutItem[]): {
  placements: MobilePlacement[];
  rows: number;
} {
  const taken: boolean[][] = [];
  const free = (row: number, col: number) => !taken[row]?.[col];
  const fits = (row: number, col: number, w: number, h: number) => {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) if (!free(r, c)) return false;
    }
    return true;
  };

  const placements: MobilePlacement[] = [];
  for (const item of items) {
    if (item.hidden) continue;
    let placed = false;
    for (let row = 0; !placed; row++) {
      for (let col = 0; col + item.w <= MOBILE_COLUMNS && !placed; col++) {
        if (!fits(row, col, item.w, item.h)) continue;
        for (let r = row; r < row + item.h; r++) {
          taken[r] ??= [];
          for (let c = col; c < col + item.w; c++) taken[r][c] = true;
        }
        placements.push({ widgetType: item.widgetType, col, row, w: item.w, h: item.h });
        placed = true;
      }
    }
  }
  return { placements, rows: taken.length };
}

/**
 * The grid as it reads when not being edited: a one-column card with nothing
 * beside it for its whole height is drawn across both columns, so the hub has
 * no half-empty rows. While editing, cards show their true size instead, so
 * what you resize is what you see.
 */
export function stretchLoneCards(placements: MobilePlacement[]): MobilePlacement[] {
  const occupied = (row: number, col: number, self: MobilePlacement) =>
    placements.some(
      (p) =>
        p !== self &&
        col >= p.col &&
        col < p.col + p.w &&
        row >= p.row &&
        row < p.row + p.h,
    );
  return placements.map((p) => {
    if (p.w !== 1) return p;
    const other = p.col === 0 ? 1 : 0;
    for (let row = p.row; row < p.row + p.h; row++) {
      if (occupied(row, other, p)) return p;
    }
    return { ...p, col: 0, w: 2 };
  });
}

/** Where one card lands when `items` is packed, or undefined if it is not shown. */
function cellOf(items: MobileLayoutItem[], widgetType: CardWidgetType) {
  return packMobileGrid(items).placements.find((p) => p.widgetType === widgetType);
}

/**
 * Move a card to where another one is in the order. Dragging forward lands
 * after the card you dropped on, dragging back lands before it, which is how
 * a dragged card reads as taking that card's place. Hidden cards keep their
 * spot in the list, so showing one again puts it back where it was.
 *
 * Dragging a small card forward onto a full-width one can leave it exactly
 * where it was: the hole it leaves is the first free spot, so the packer
 * flows it straight back in and the wide card never moves down. Then the
 * card goes in just before the one dropped on, and the next card that can
 * fill the hole it left moves up into it, so the dragged card takes the wide
 * card's row and the wide card goes under.
 */
export function moveCard(
  items: MobileLayoutItem[],
  widgetType: CardWidgetType,
  onto: CardWidgetType,
): MobileLayoutItem[] {
  if (widgetType === onto) return items;
  const known = new Set(items.map((item) => item.widgetType));
  if (!known.has(widgetType) || !known.has(onto)) return items;
  return moveInOrder(inReadingOrder(items), widgetType, onto);
}

/**
 * The list reordered to match how the grid reads, top to bottom then left to
 * right, without moving any card on screen. The packer lets a later small
 * card fill a hole beside an earlier one (a card after a full-width one can
 * sit above it), so the saved order and what you see can disagree; a move
 * made on the saved order then lands somewhere other than where it looks like
 * it should, such as beside the card above instead of in a full-width card's
 * row. Hidden cards keep their places in the list.
 */
function inReadingOrder(items: MobileLayoutItem[]): MobileLayoutItem[] {
  const { placements } = packMobileGrid(items);
  const byType = new Map(items.map((item) => [item.widgetType, item]));
  const shown = [...placements]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((p) => byType.get(p.widgetType)!);
  let next = 0;
  const ordered = items.map((item) => (item.hidden ? item : shown[next++]));
  // Tall cards can pack differently in the new order; keep the old one then.
  const same = (a: MobilePlacement[], b: MobilePlacement[]) =>
    a.length === b.length &&
    a.every((p) => {
      const q = b.find((other) => other.widgetType === p.widgetType);
      return q !== undefined && q.row === p.row && q.col === p.col;
    });
  return same(placements, packMobileGrid(ordered).placements) ? ordered : items;
}

function moveInOrder(
  items: MobileLayoutItem[],
  widgetType: CardWidgetType,
  onto: CardWidgetType,
): MobileLayoutItem[] {
  const from = items.findIndex((item) => item.widgetType === widgetType);
  const to = items.findIndex((item) => item.widgetType === onto);
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  if (to < from) return next;

  const was = cellOf(items, widgetType);
  const now = cellOf(next, widgetType);
  if (!was || !now || was.row !== now.row || was.col !== now.col) return next;

  for (let i = to + 1; i < items.length; i++) {
    const filler = items[i];
    if (filler.hidden) continue;
    const order = items.filter((_, j) => j !== from && j !== i);
    order.splice(order.indexOf(items[to]), 0, moved);
    order.splice(from, 0, filler);
    const landed = cellOf(order, widgetType);
    if (landed && (landed.row !== was.row || landed.col !== was.col)) return order;
  }
  return next;
}

/** Change one card's size, keeping everything else as it is. */
export function resizeCard(
  items: MobileLayoutItem[],
  widgetType: CardWidgetType,
  size: { w: MobileSpan; h: MobileSpan },
): MobileLayoutItem[] {
  return items.map((item) => (item.widgetType === widgetType ? { ...item, ...size } : item));
}
