import { useLayout } from '@artist/api-client';
import type { WidgetType } from '@artist/shared';

/**
 * The widgets this board shows, in order.
 *
 * `GET /boards/:id/layout` returns the layout already merged — the user's
 * arrangement over the board default, applied server-side — so order and
 * `hidden` are read straight off it rather than re-derived here.
 *
 * Both the hub grid and the spoke pager need the same list, and they must
 * agree: paging past the end of one while the other shows nine cards would be
 * a confusing kind of wrong.
 */
export function useVisibleWidgets(boardId: string) {
  const layout = useLayout(boardId);
  const widgets = (layout.data?.layout ?? [])
    .filter((item) => item.hidden !== true)
    // A tab, not a widget — it is never in a layout, but filtering is cheaper
    // than trusting that.
    .filter((item) => item.widgetType !== 'CALENDAR')
    .map((item): WidgetType => item.widgetType);

  return { widgets, loading: layout.isPending, error: layout.error };
}
