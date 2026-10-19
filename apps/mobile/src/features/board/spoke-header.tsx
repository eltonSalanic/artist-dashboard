import { View } from 'react-native';
import { useBoard } from '@artist/api-client';
import { WIDGET_META, resolveBoardTheme, type EventType, type WidgetType } from '@artist/shared';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { shadows, spacing, usePosterCanvas, useScheme, widgetInk, type WidgetInk } from '@/theme';
import { WIDGET_ICONS } from './widget-icons';

/** The widget each kind of event lives in, and so takes its colour from. */
export const EVENT_WIDGET: Record<EventType, WidgetType> = {
  SHOW: 'SHOWS',
  REHEARSAL: 'NEXT_REHEARSALS',
  MEETING: 'NEXT_MEETINGS',
};

/**
 * A widget's own colours on this band: what its card on the widget page is
 * painted with, so its expanded screen and its calendar items match it.
 */
export function useWidgetInk(boardId: string, widgetType: WidgetType): WidgetInk {
  const board = useBoard(boardId);
  return widgetInk(resolveBoardTheme(board.data?.theme), widgetType, useScheme());
}

/**
 * The top of a widget's expanded screen, after a Spotify playlist header: a
 * small cover in the widget's colour with its icon, the name set large, and
 * one line saying what is in it. The cover is the same colour as the card you
 * tapped, so the screen reads as that card opened up.
 */
export function SpokeHeader({
  boardId,
  widgetType,
  summary,
}: {
  boardId: string;
  widgetType: WidgetType;
  /** "6 open · 2 due today". Null while loading, or when there is nothing to say. */
  summary?: string | null;
}) {
  const canvas = usePosterCanvas();
  const ink = useWidgetInk(boardId, widgetType);
  const title = WIDGET_META[widgetType].title;

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={summary ? `${title}. ${summary}` : title}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: spacing.md,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          borderCurve: 'continuous',
          backgroundColor: ink.bg,
          boxShadow: ink.plain ? shadows.card : shadows.raised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={WIDGET_ICONS[widgetType]} size={28} color={ink.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {/* Wraps rather than shrinking to fit: pages off to the side of the
            pager measure at zero width, and a shrink-to-fit title measured
            there stays shrunk to a dash. */}
        <PosterText
          variant="display"
          color={canvas.ink}
          numberOfLines={2}
          style={{ fontSize: 32, lineHeight: 36, letterSpacing: -1.1 }}
        >
          {title}
        </PosterText>
        {summary ? (
          <PosterText variant="cardMeta" color={canvas.soft} numberOfLines={1}>
            {summary}
          </PosterText>
        ) : null}
      </View>
    </View>
  );
}
