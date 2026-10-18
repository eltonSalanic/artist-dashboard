import { View } from 'react-native';
import { useFocus } from '@artist/api-client';
import { FocusPeriods } from '@artist/shared';
import { PosterText } from '@/components/poster-text';
import { SpokeList } from '@/components/spoke-list';
import { spacing, usePosterCanvas } from '@/theme';
import { SpokeHeader } from '../spoke-header';

/** All three horizons, whether or not they are set — the blanks are the point:
 *  an unset period is a prompt, and hiding it hides the prompt. */
export function FocusSpoke({ boardId }: { boardId: string }) {
  const canvas = usePosterCanvas();
  const focus = useFocus(boardId);
  const byPeriod = new Map((focus.data ?? []).map((pin) => [pin.period, pin.text]));
  const set = FocusPeriods.filter((period) => byPeriod.get(period)?.trim()).length;

  return (
    <SpokeList
      pending={focus.isPending}
      error={focus.error}
      onRetry={() => void focus.refetch()}
      empty={false}
      emptyIcon={{ sf: 'bolt', md: 'bolt' }}
      emptyTitle="No focus set"
      header={
        <SpokeHeader
          boardId={boardId}
          widgetType="FOCUS"
          summary={focus.isPending ? null : `${set} of ${FocusPeriods.length} set`}
        />
      }
    >
      <View style={{ gap: spacing.lg }}>
        {FocusPeriods.map((period) => {
          const text = byPeriod.get(period)?.trim();
          return (
            <View key={period} style={{ gap: spacing.xs }}>
              <PosterText variant="label" color={canvas.soft}>
                THIS {period}
              </PosterText>
              {text ? (
                <PosterText variant="title" color={canvas.ink}>
                  {text}
                </PosterText>
              ) : (
                <PosterText variant="body" color={canvas.soft}>
                  Not set
                </PosterText>
              )}
            </View>
          );
        })}
      </View>
    </SpokeList>
  );
}
