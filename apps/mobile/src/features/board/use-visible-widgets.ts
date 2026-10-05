import { useMobileLayout } from '@artist/api-client';
import type { CardWidgetType, MobileLayoutItem } from '@artist/shared';

/**
 * The phone arrangement of this board, and the cards it shows, in order.
 *
 * The phone has its own arrangement (P12b): `GET /mobile-layout` serves the
 * one saved on a phone or, until there is one, one derived from the web
 * layout. Either way it is already a list, so nothing here reads web's grid.
 *
 * Both the hub grid and the spoke pager need the same order, and they must
 * agree: paging past the end of one while the other shows nine cards would be
 * a confusing kind of wrong.
 */
export function useVisibleWidgets(boardId: string) {
  const layout = useMobileLayout(boardId);
  const items: MobileLayoutItem[] = layout.data?.items ?? [];
  const widgets = items
    .filter((item) => !item.hidden)
    .map((item): CardWidgetType => item.widgetType);

  return {
    items,
    widgets,
    source: layout.data?.source ?? 'web',
    loading: layout.isPending,
    error: layout.error,
  };
}
