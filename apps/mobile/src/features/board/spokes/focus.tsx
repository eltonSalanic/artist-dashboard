import { View } from 'react-native';
import { useFocus } from '@artist/api-client';
import { FocusPeriods } from '@artist/shared';
import { SpokeList } from '@/components/spoke-list';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/theme';

/** All three horizons, whether or not they are set — the blanks are the point:
 *  an unset period is a prompt, and hiding it hides the prompt. */
export function FocusSpoke({ boardId }: { boardId: string }) {
  const focus = useFocus(boardId);
  const byPeriod = new Map((focus.data ?? []).map((pin) => [pin.period, pin.text]));

  return (
    <SpokeList
      pending={focus.isPending}
      error={focus.error}
      onRetry={() => void focus.refetch()}
      empty={false}
      emptyIcon={{ sf: 'bolt', md: 'bolt' }}
      emptyTitle="No focus set"
    >
      <View style={{ gap: spacing.lg }}>
        {FocusPeriods.map((period) => {
          const text = byPeriod.get(period)?.trim();
          return (
            <View key={period} style={{ gap: spacing.xs }}>
              <ThemedText variant="caption" tone="muted">
                THIS {period}
              </ThemedText>
              {text ? (
                <ThemedText variant="title">{text}</ThemedText>
              ) : (
                <ThemedText variant="body" tone="muted">
                  Not set
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>
    </SpokeList>
  );
}
