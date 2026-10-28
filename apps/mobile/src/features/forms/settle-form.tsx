import { useState } from 'react';
import { View } from 'react-native';
import {
  categoryLabel,
  formatMoney,
  localDayISO,
  parseMoneyToCents,
  showSettlement,
  type LedgerEntry,
  type SettleShowDto,
  type ShowSettlementDto,
} from '@artist/shared';
import { usePermissions, useSettleShow, useShowSettlement } from '@artist/api-client';
import { ChoiceChips } from '@/components/choice-chips';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { TextField } from '@/components/text-field';
import { useWidgetInk } from '@/features/board/spoke-header';
import { spacing } from '@/theme';
import { FormGate } from './form-gate';
import { FormPoster } from './form-poster';
import { FormScreen } from './form-screen';

const BAND = '__band__';

/**
 * Settle a show from the phone, where the cash is: the fee, merch, and the
 * night's costs, with everyone's cut shown before it is saved. Line-by-line
 * categories are web's job; here costs go in as one figure.
 */
export function SettleForm({ boardId, eventId }: { boardId: string; eventId: string }) {
  const { can } = usePermissions();
  const settlement = useShowSettlement(boardId, eventId);
  return (
    <FormGate
      allowed={can('finance.manage')}
      pending={settlement.isPending}
      missing={!settlement.data}
      what="show's money"
    >
      {settlement.data && <SettleFields boardId={boardId} data={settlement.data} />}
    </FormGate>
  );
}

function SettleFields({ boardId, data }: { boardId: string; data: ShowSettlementDto }) {
  const settle = useSettleShow(boardId);
  const ink = useWidgetInk(boardId, 'SHOWS');
  const money = (cents: number) => formatMoney(cents, data.currency);
  const expected = data.entries.filter((e) => e.state === 'EXPECTED');
  const hasFee = data.entries.some((e) => e.category === 'SHOW_FEE');

  const [note, setNote] = useState('');
  const [received, setReceived] = useState<string[]>([]);
  const [fee, setFee] = useState('');
  const [merch, setMerch] = useState('');
  const [merchHeldBy, setMerchHeldBy] = useState(BAND);
  const [costs, setCosts] = useState('');
  const [costsPaidBy, setCostsPaidBy] = useState(BAND);

  const amounts = { fee, merch, costs };
  const parsed = Object.fromEntries(
    Object.entries(amounts).map(([key, text]) => [key, text.trim() ? parseMoneyToCents(text) : 0]),
  ) as Record<keyof typeof amounts, number | null>;
  const invalid = Object.values(parsed).some((v) => v === null);
  const occurredOn = (() => {
    const day = localDayISO(new Date(data.event.startsAt));
    return day > localDayISO() ? localDayISO() : day;
  })();

  const lines: SettleShowDto['lines'] = [
    ...(parsed.fee
      ? [{ kind: 'INCOME' as const, category: 'SHOW_FEE' as const, amountCents: parsed.fee }]
      : []),
    ...(parsed.merch
      ? [
          {
            kind: 'INCOME' as const,
            category: 'MERCH_SALES' as const,
            amountCents: parsed.merch,
            handledById: merchHeldBy === BAND ? null : merchHeldBy,
          },
        ]
      : []),
    ...(parsed.costs
      ? [
          {
            kind: 'EXPENSE' as const,
            category: 'OTHER_EXPENSE' as const,
            amountCents: parsed.costs,
            description: note.trim() || 'Show costs',
            handledById: costsPaidBy === BAND ? null : costsPaidBy,
          },
        ]
      : []),
  ];

  const preview = showSettlement([
    ...data.entries.map(
      (e): LedgerEntry => ({ ...e, state: received.includes(e.id) ? 'SETTLED' : e.state }),
    ),
    ...lines.map(
      (l): LedgerEntry => ({
        kind: l.kind,
        state: 'SETTLED',
        amountCents: l.amountCents,
        category: l.category,
        occurredOn,
        handledById: l.handledById ?? null,
        splits: data.split,
      }),
    ),
  ]);

  const dirty = lines.length > 0 || received.length > 0;
  const name = (userId: string | null) =>
    userId === null
      ? 'Band fund'
      : (data.members.find((m) => m.id === userId)?.displayName ?? 'Former member');
  const people = [
    { value: BAND, label: 'Band account' },
    ...data.members.map((m) => ({ value: m.id, label: m.displayName })),
  ];

  return (
    <FormScreen
      title={`Settle ${data.event.title}`}
      dirty={dirty}
      canSave={dirty && !invalid}
      saving={settle.isPending}
      onSave={() =>
        settle.mutateAsync({
          eventId: data.event.id,
          dto: { occurredOn, receivedIds: received, lines },
        })
      }
      postered
    >
      <FormPoster
        boardId={boardId}
        ink={ink}
        label={`Settle ${data.event.title}`}
        fieldLabel="Note on the costs"
        placeholder="Costs: gas, sound guy…"
        value={note}
        onChangeText={setNote}
        maxLength={2000}
      />

      {expected.length > 0 && (
        <ChoiceChips<string>
          multiple
          label="Fees that arrived"
          value={received}
          onChange={setReceived}
          choices={expected.map((e) => ({
            value: e.id,
            label: `${e.description || categoryLabel(e.category)} · ${money(e.amountCents)}`,
          }))}
        />
      )}

      <View style={{ gap: spacing.md }}>
        {!hasFee && (
          <TextField
            label="Show fee"
            value={fee}
            onChangeText={setFee}
            keyboardType="decimal-pad"
            placeholder="0.00"
            error={parsed.fee === null ? 'Enter an amount like 250' : null}
          />
        )}
        <TextField
          label="Merch sales"
          value={merch}
          onChangeText={setMerch}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={parsed.merch === null ? 'Enter an amount like 85' : null}
        />
        {parsed.merch ? (
          <ChoiceChips<string>
            label="Who has the merch cash"
            value={merchHeldBy}
            onChange={setMerchHeldBy}
            choices={people}
          />
        ) : null}
        <TextField
          label="Costs"
          value={costs}
          onChangeText={setCosts}
          keyboardType="decimal-pad"
          placeholder="0.00"
          error={parsed.costs === null ? 'Enter an amount like 40' : null}
        />
        {parsed.costs ? (
          <ChoiceChips<string>
            label="Who paid the costs"
            value={costsPaidBy}
            onChange={setCostsPaidBy}
            choices={people}
          />
        ) : null}
      </View>

      <Section title={`THE SPLIT · ${money(preview.netCents)} NET`}>
        {data.split.map((share, index) => (
          <Row
            key={share.userId ?? 'fund'}
            first={index === 0}
            title={name(share.userId)}
            meta={`${share.shareBps / 100}%`}
            trailing={money(
              share.userId === null
                ? preview.bandFundCents
                : (preview.cuts.find((c) => c.userId === share.userId)?.cents ?? 0),
            )}
          />
        ))}
      </Section>
    </FormScreen>
  );
}
