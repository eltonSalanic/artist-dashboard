import { useState } from 'react';
import { View } from 'react-native';
import { formatMoney, localDayISO, parseMoneyToCents } from '@artist/shared';
import { useCreatePayout, useFinanceSummary, usePermissions } from '@artist/api-client';
import { ChoiceChips } from '@/components/choice-chips';
import { DateField } from '@/components/date-field';
import { PosterText } from '@/components/poster-text';
import { TextField } from '@/components/text-field';
import { spacing, useThemeColors } from '@/theme';
import { FormGate } from './form-gate';
import { FormScreen } from './form-screen';

type Direction = 'TO_MEMBER' | 'TO_BAND';

const fromDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Money that changed hands between the band and a member outside the app
 * ("I Venmo'd Sam his $80"). Admins only. Opens on what the member is owed,
 * so squaring someone up is one tap on Save.
 *
 *   ?member=…  who was paid, or who paid the band
 */
export function PayoutForm({ boardId, memberId }: { boardId: string; memberId: string }) {
  const { can } = usePermissions();
  const summary = useFinanceSummary(boardId, {}, can('finance.manage'));
  return (
    <FormGate
      allowed={can('finance.manage')}
      pending={summary.isPending}
      missing={!summary.data}
      what="payment"
    >
      {summary.data && (
        <PayoutFields
          boardId={boardId}
          memberId={memberId}
          name={
            summary.data.members.find((m) => m.id === memberId)?.displayName ?? 'Former member'
          }
          balanceCents={
            summary.data.balances.members.find((m) => m.userId === memberId)?.balanceCents ?? 0
          }
          currency={summary.data.currency}
        />
      )}
    </FormGate>
  );
}

function PayoutFields({
  boardId,
  memberId,
  name,
  balanceCents,
  currency,
}: {
  boardId: string;
  memberId: string;
  name: string;
  balanceCents: number;
  currency: string;
}) {
  const colors = useThemeColors();
  const create = useCreatePayout(boardId);
  const [direction, setDirection] = useState<Direction>(
    balanceCents < 0 ? 'TO_BAND' : 'TO_MEMBER',
  );
  const [amount, setAmount] = useState(
    balanceCents === 0 ? '' : (Math.abs(balanceCents) / 100).toFixed(2),
  );
  const [paidOn, setPaidOn] = useState(localDayISO());
  const [note, setNote] = useState('');
  const cents = parseMoneyToCents(amount);
  const valid = cents !== null && cents > 0;

  return (
    <FormScreen
      title="Record a payment"
      dirty={amount !== '' || note !== ''}
      canSave={valid}
      saving={create.isPending}
      onSave={() =>
        create.mutateAsync({
          userId: memberId,
          amountCents: direction === 'TO_MEMBER' ? (cents ?? 0) : -(cents ?? 0),
          paidOn,
          note: note.trim() || undefined,
        })
      }
    >
      <View style={{ gap: spacing.md }}>
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          {balanceCents > 0
            ? `The band owes ${name} ${formatMoney(balanceCents, currency)}.`
            : balanceCents < 0
              ? `${name} owes the band ${formatMoney(-balanceCents, currency)}.`
              : `${name} and the band are square.`}
        </PosterText>
        <ChoiceChips<Direction>
          label="Who paid"
          value={direction}
          onChange={setDirection}
          choices={[
            { value: 'TO_MEMBER', label: `Band paid ${name}` },
            { value: 'TO_BAND', label: `${name} paid the band` },
          ]}
        />
        <TextField
          label={`Amount (${currency})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          required
          error={amount !== '' && !valid ? 'Enter an amount like 12.50' : null}
        />
        <DateField
          label="Paid on"
          mode="date"
          clearable={false}
          value={fromDay(paidOn)}
          onChange={(date) => date && setPaidOn(localDayISO(date))}
        />
        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Venmo, cash at the show…"
          maxLength={500}
        />
      </View>
    </FormScreen>
  );
}
