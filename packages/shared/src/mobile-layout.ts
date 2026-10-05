import type { WidgetType } from './enums';
import { readingOrder, type LayoutItem } from './layout';

/**
 * The phone's own arrangement of a board's widgets: an ordered list, each card
 * full or half width, each shown or hidden.
 *
 * Web's layout is a freeform 12-column grid and a phone has two columns at
 * most, so the phone does not borrow web's positions. Until someone saves an
 * arrangement on the phone it *follows* web (`mobileLayoutFromWeb`); after
 * that the two never move each other.
 */
export const MobileCardSizes = ['full', 'half'] as const;
export type MobileCardSize = (typeof MobileCardSizes)[number];

// A type alias, not an interface: an alias is assignable to the Prisma `Json`
// the API stores it as, an interface is not.
export type MobileLayoutItem = {
  widgetType: CardWidgetType;
  size: MobileCardSize;
  hidden?: boolean;
};

/** Every widget but the Calendar, which is a tab on the phone, never a card. */
export type CardWidgetType = Exclude<WidgetType, 'CALENDAR'>;

/** Where a phone arrangement came from: derived from web, or saved on a phone. */
export type MobileLayoutSource = 'web' | 'phone';

export interface MobileLayoutResponse {
  items: MobileLayoutItem[];
  source: MobileLayoutSource;
}

/** Prose and long lists read badly at half width; counts sit two-up. */
const FULL_BY_DEFAULT: readonly WidgetType[] = ['FOCUS', 'CUSTOM', 'TODOS', 'ACTIVITY_FEED'];

export function defaultMobileSize(widgetType: WidgetType): MobileCardSize {
  return FULL_BY_DEFAULT.includes(widgetType) ? 'full' : 'half';
}

/** A tab, not a widget: it is in web's layout but never a card. */
const isCard = (item: LayoutItem): item is LayoutItem & { widgetType: CardWidgetType } =>
  item.widgetType !== 'CALENDAR';

/**
 * A phone arrangement that follows web: web's reading order (top to bottom,
 * then left to right), default widths, and web's hidden widgets.
 *
 * `web` is the merged layout `GET /layout` serves, so a member who has not
 * arranged anything gets the band's default through it.
 */
export function mobileLayoutFromWeb(web: LayoutItem[]): MobileLayoutItem[] {
  return readingOrder(web)
    .filter(isCard)
    .map((item): MobileLayoutItem => ({
      widgetType: item.widgetType,
      size: defaultMobileSize(item.widgetType),
      ...(item.hidden ? { hidden: true } : {}),
    }));
}

/**
 * A saved phone arrangement, brought up to date with the widgets the board has
 * now. Widgets the board no longer has drop out; widgets it gained since the
 * save are added at the end, in web's order and as web shows them. Everything
 * the person chose (order, widths, hidden) is kept.
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

/**
 * The hub's rows: the shown cards in order, two half cards to a row. A half
 * card whose neighbour is full width, or that is last, gets a row to itself
 * and is drawn full width. Order is never changed to fill a gap.
 */
export function mobileRows(items: MobileLayoutItem[]): MobileLayoutItem[][] {
  const shown = items.filter((item) => !item.hidden);
  const rows: MobileLayoutItem[][] = [];
  for (let i = 0; i < shown.length; i++) {
    const item = shown[i];
    const next = shown[i + 1];
    if (item.size === 'half' && next?.size === 'half') {
      rows.push([item, next]);
      i++;
    } else {
      rows.push([item]);
    }
  }
  return rows;
}
