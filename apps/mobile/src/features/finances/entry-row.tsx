import { View } from 'react-native';
import { categoryLabel, paybackStatus, type FinanceEntryDto } from '@artist/shared';
import { Row } from '@/components/row';
import { spacing } from '@/theme';
import { shortDate } from '../board/format';
import { FinanceAmount } from './finance-amount';
import { PaybackLabel } from './payback-label';

/**
 * One ledger line: what it was for, when and who paid, the signed amount, and
 * for an out-of-pocket expense whether it's owed back or paid back. Tapping
 * opens the entry's form.
 */
export function FinanceEntryRow({
  entry,
  currency,
  first,
  name,
  showPayer = true,
  onPress,
}: {
  entry: FinanceEntryDto;
  currency: string;
  first: boolean;
  name: (userId: string) => string;
  /** Off on a member's own list, where every row is theirs. */
  showPayer?: boolean;
  onPress: () => void;
}) {
  const status = paybackStatus(entry);
  return (
    <Row
      first={first}
      title={entry.description || categoryLabel(entry.category)}
      meta={[
        shortDate(`${entry.occurredOn}T12:00:00`),
        entry.state === 'EXPECTED' ? 'expected' : null,
        showPayer && entry.handledById ? `${name(entry.handledById)} paid` : null,
        // Who was paid (or paid the band) says more than the category.
        entry.counterparty ?? (entry.description ? categoryLabel(entry.category) : null),
        entry.receiptCount > 0 ? 'receipt' : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          <FinanceAmount
            cents={entry.kind === 'INCOME' ? entry.amountCents : -entry.amountCents}
            currency={currency}
            signed
          />
          {status && <PaybackLabel status={status} />}
        </View>
      }
      onPress={onPress}
    />
  );
}
