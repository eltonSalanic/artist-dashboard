import { View } from 'react-native';
import { categoryLabel, formatMoney, paybackStatus, type FinanceEntryDto } from '@artist/shared';
import { spacing } from '@/theme';
import { shortDate } from '../board/format';
import { PaybackLabel } from './payback-label';
import { categoryIcon } from './wallet-helpers';
import { CategoryBadge, Money, TxRow } from './wallet-ui';

/**
 * One transaction, as a banking app lists it: the category's icon in a circle,
 * what it was for, when and who paid, the signed amount, and for an
 * out-of-pocket expense whether it's owed back or paid back. Tapping opens the
 * entry's form.
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
  const income = entry.kind === 'INCOME';
  const title = entry.description || categoryLabel(entry.category);
  const meta = [
    shortDate(`${entry.occurredOn}T12:00:00`),
    entry.state === 'EXPECTED' ? 'expected' : null,
    showPayer && entry.handledById ? `${name(entry.handledById)} paid` : null,
    // Who was paid (or paid the band) says more than the category.
    entry.counterparty ?? (entry.description ? categoryLabel(entry.category) : null),
    entry.receiptCount > 0 ? 'receipt' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <TxRow
      first={first}
      lead={<CategoryBadge icon={categoryIcon(entry.category, entry.kind)} income={income} />}
      title={title}
      meta={meta}
      accessibilityLabel={`${title}, ${income ? 'income' : 'expense'} ${formatMoney(entry.amountCents, currency)}, ${meta}${status ? `, ${status === 'owed' ? 'owed back' : 'paid back'}` : ''}`}
      trailing={
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          <Money cents={entry.amountCents} currency={currency} tone={income ? 'in' : 'out'} />
          {status && <PaybackLabel status={status} />}
        </View>
      }
      onPress={onPress}
    />
  );
}
