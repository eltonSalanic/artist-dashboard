import { View } from 'react-native';
import { router } from 'expo-router';
import { usePermissions, useShowSettlement } from '@artist/api-client';
import { formatMoney } from '@artist/shared';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { spacing, useThemeColors } from '@/theme';

/** A show's money, on the show: the net and each cut. */
export function ShowMoney({ boardId, eventId }: { boardId: string; eventId: string }) {
  const colors = useThemeColors();
  const { can } = usePermissions();
  const visible = can('finance.view');
  const settlement = useShowSettlement(boardId, visible ? eventId : null);
  if (!visible) return null;

  const data = settlement.data;
  const money = (cents: number) => formatMoney(cents, data?.currency ?? 'USD');

  return (
    <Section title={data && data.entries.length > 0 ? `MONEY · ${money(data.netCents)} NET` : 'MONEY'}>
      {!data ? (
        <Skeleton width="100%" height={48} />
      ) : data.entries.length === 0 ? (
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          Nothing logged for this show yet.
        </PosterText>
      ) : (
        <View>
          <Row first title="In" trailing={money(data.incomeCents)} />
          <Row title="Out" trailing={money(-data.expenseCents)} />
          {data.expectedCents > 0 && (
            <Row title="Still owed" trailing={money(data.expectedCents)} />
          )}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        {can('finance.create') && (
          <Button
            title="Add Expense/Income"
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/board/${boardId}/form/finance?eventId=${eventId}`)}
          />
        )}
      </View>
    </Section>
  );
}
