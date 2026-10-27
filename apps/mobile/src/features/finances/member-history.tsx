import { View } from 'react-native';
import { router } from 'expo-router';
import { useFinanceEntries, usePayouts } from '@artist/api-client';
import { categoryLabel, formatMoney } from '@artist/shared';
import { ListState } from '@/components/list-state';
import { PosterText } from '@/components/poster-text';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { spacing, usePosterCanvas } from '@/theme';
import { FinanceAmount } from './finance-amount';
import { shortDate } from '../board/format';

export function MemberHistory({
  boardId,
  userId,
  currency,
}: {
  boardId: string;
  userId: string;
  currency: string;
}) {
  const canvas = usePosterCanvas();
  const entries = useFinanceEntries(boardId, { kind: 'EXPENSE' });
  const payouts = usePayouts(boardId);
  if (entries.isPending || payouts.isPending || entries.error || payouts.error)
    return (
      <ListState
        pending={entries.isPending || payouts.isPending}
        error={entries.error ?? payouts.error}
        onRetry={() => {
          void entries.refetch();
          void payouts.refetch();
        }}
        icon={{ sf: 'dollarsign.circle', md: 'account-balance-wallet' }}
        title="Member history"
      />
    );
  const expenses = (entries.data ?? []).filter(
    (e) => e.handledById === userId && e.state === 'SETTLED',
  );
  const payments = (payouts.data ?? []).filter((p) => p.userId === userId);
  return (
    <View style={{ gap: spacing.md, padding: spacing.sm }}>
      <PosterText variant="cardMeta" color={canvas.soft}>
        All-time expenses paid personally and recorded payments. Earnings shares also affect the
        amount owed.
      </PosterText>
      <Section title="EXPENSES">
        {expenses.length === 0 && (
          <PosterText variant="cardMeta" color={canvas.soft}>
            No personal expenses recorded.
          </PosterText>
        )}
        {expenses.map((e, i) => (
          <Row
            key={e.id}
            first={i === 0}
            title={e.description || categoryLabel(e.category)}
            meta={`${shortDate(`${e.occurredOn}T12:00:00`)}${e.note ? ` · ${e.note}` : ''}`}
            trailing={<FinanceAmount cents={-e.amountCents} currency={currency} />}
            onPress={() => router.push(`/board/${boardId}/form/finance?id=${e.id}`)}
          />
        ))}
      </Section>
      <Section title="PAYOUTS">
        {payments.length === 0 && (
          <PosterText variant="cardMeta" color={canvas.soft}>
            No payments recorded.
          </PosterText>
        )}
        {payments.map((p, i) => (
          <Row
            key={p.id}
            first={i === 0}
            title={p.amountCents > 0 ? 'Received from band' : 'Paid to band'}
            meta={`${shortDate(`${p.paidOn}T12:00:00`)}${p.note ? ` · ${p.note}` : ''}`}
            trailing={formatMoney(Math.abs(p.amountCents), currency)}
          />
        ))}
      </Section>
    </View>
  );
}
