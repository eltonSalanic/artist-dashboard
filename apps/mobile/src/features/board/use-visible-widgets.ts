import { useMobileLayout } from '@artist/api-client';
import { mobileRows, type CardWidgetType, type MobileLayoutItem } from '@artist/shared';

/**
 * The cards this board shows on the phone, in order, and the hub's rows.
 *
 * The phone has its own arrangement (P12b): `GET /mobile-layout` serves the
 * one saved on a phone or, until there is one, one derived from the web
 * layout. Either way it is already a list, so nothing here reads web's grid.
 *
 * Both the hub grid and the spoke pager need the same list, and they must
 * agree: paging past the end of one while the other shows nine cards would be
 * a confusing kind of wrong.
 */
export function useVisibleWidgets(boardId: string) {
  const layout = useMobileLayout(boardId);
  const items = layout.data?.items ?? [];
  const widgets = items
    .filter((item) => !item.hidden)
    .map((item): CardWidgetType => item.widgetType);
  const rows: MobileLayoutItem[][] = mobileRows(items);

  return { widgets, rows, loading: layout.isPending, error: layout.error };
}
