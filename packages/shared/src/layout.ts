import type { WidgetType } from './enums';

/** Layout new boards start with; admins customize it later. */
export const DEFAULT_BOARD_LAYOUT: LayoutItem[] = [
  { widgetType: 'FOCUS', x: 0, y: 0, w: 12, h: 2 },
  { widgetType: 'TODOS', x: 0, y: 2, w: 8, h: 6 },
  { widgetType: 'MY_TASKS', x: 8, y: 2, w: 4, h: 6 },
  { widgetType: 'SHOWS', x: 0, y: 8, w: 4, h: 4 },
  { widgetType: 'NEXT_REHEARSALS', x: 4, y: 8, w: 4, h: 4 },
  { widgetType: 'ACTIVITY_FEED', x: 8, y: 8, w: 4, h: 4 },
];

export interface LayoutItem {
  widgetType: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
}

/**
 * Merge a user's saved layout over the board's default layout.
 * - Keyed by widgetType (stable across layout edits, unlike RGL ids).
 * - Widgets removed from the default disappear for everyone.
 * - Widgets added to the default after the user saved appear below the
 *   user's existing grid.
 */
export function mergeLayouts(
  defaultLayout: LayoutItem[],
  userLayout: LayoutItem[] | null | undefined,
): LayoutItem[] {
  if (!userLayout || userLayout.length === 0) return defaultLayout;
  const userByType = new Map(userLayout.map((i) => [i.widgetType, i]));
  const maxUserY = Math.max(0, ...userLayout.map((i) => i.y + i.h));
  let appendY = maxUserY;
  return defaultLayout.map((def) => {
    const own = userByType.get(def.widgetType);
    if (own) return own;
    const placed = { ...def, x: 0, y: appendY };
    appendY += def.h;
    return placed;
  });
}
