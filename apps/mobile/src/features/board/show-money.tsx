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

/** A show's money, on the show: the net, each cut, and Settle for an admin. */
export function ShowMoney({ boardId, eventId }: { boardId: string; eventId: string }) {
  const colors = useThemeColors();
  const { can } = usePermissions();
  const visible = can('finance.view');
  const settlement = useShowSettlement(boardId, visible ? eventId : null);
  if (!visible) return null;

  const data = settlement.data;
  const money = (cents: number) => formatMoney(cents, data?.currency ?? 'USD');
  const name = (userId: string) =>
    data?.members.find((m) => m.id === userId)?.displayName ?? 'Former member';

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
          {data.expectedCents > 0 && (
            <Row first title="Still owed" trailing={money(data.expectedCents)} />
          )}
          {data.cuts.map((cut, index) => (
            <Row
              key={cut.userId}
              first={index === 0 && data.expectedCents === 0}
              title={name(cut.userId)}
              trailing={money(cut.cents)}
            />
          ))}
          {data.bandFundCents !== 0 && (
            <Row title="Band fund" trailing={money(data.bandFundCents)} />
          )}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        {can('finance.create') && (
          <Button
            title="Log Money"
            variant="secondary"
            size="sm"
            onPress={() => router.push(`/board/${boardId}/form/finance?eventId=${eventId}`)}
          />
        )}
        {can('finance.manage') && (
          <Button
            title="Settle Show"
            size="sm"
            onPress={() => router.push(`/board/${boardId}/form/settle?eventId=${eventId}`)}
          />
        )}
      </View>
    </Section>
  );
}
