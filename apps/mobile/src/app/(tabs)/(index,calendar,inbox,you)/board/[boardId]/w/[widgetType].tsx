import { useLocalSearchParams } from 'expo-router';
import { WidgetTypes, type WidgetType } from '@artist/shared';
import { BoardPermissions } from '@/features/board/board-permissions';
import { WidgetSpokeScreen } from '@/screens/widget-spoke';

/**
 * `/board/:boardId/w/:widgetType`. The board is in the path rather than taken
 * from the current selection so a push notification can open the right widget
 * on the right board from cold, with no dependency on what was selected last.
 */
export default function WidgetSpoke() {
  const { boardId, widgetType } = useLocalSearchParams<{
    boardId: string;
    widgetType: string;
  }>();

  // The segment comes from a URL, which means it can be anything.
  const type = (WidgetTypes as readonly string[]).includes(widgetType)
    ? (widgetType as WidgetType)
    : 'TODOS';

  return (
    <BoardPermissions boardId={boardId}>
      <WidgetSpokeScreen boardId={boardId} widgetType={type} />
    </BoardPermissions>
  );
}
