import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import {
  categoriesFor,
  localDayISO,
  parseMoneyToCents,
  type FinanceCategory,
  type FinanceEntryDto,
  type FinanceKind,
} from '@artist/shared';
import {
  useBoard,
  useCreateFinanceEntry,
  useEvents,
  useFinanceEntry,
  useMe,
  usePermissions,
  useUpdateFinanceEntry,
  useVoidFinanceEntry,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { DateField } from '@/components/date-field';
import { PickOne } from '@/components/pick-one';
import { PosterText } from '@/components/poster-text';
import { TextField } from '@/components/text-field';
import { TaskAttachments } from '@/features/attachments/task-attachments';
import { useWidgetInk } from '@/features/board/spoke-header';
import { spacing, useThemeColors } from '@/theme';
import { FormGate } from './form-gate';
import { FormPoster } from './form-poster';
import { FormScreen, useLeaveForm } from './form-screen';

const BAND = '__band__';

const fromDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * One line of the band's books. Any member can log one; a new entry reopens as
 * itself once saved, so the receipt can go on while it is still in hand.
 *
 *   ?id=…       edit that entry
 *   ?kind=INCOME|EXPENSE  what a new one starts as
 *   ?eventId=…  a new one already filed against that show
 */
export function FinanceForm({
  boardId,
  entryId,
  kind,
  eventId,
}: {
  boardId: string;
  entryId?: string;
  kind?: FinanceKind;
  eventId?: string;
}) {
  const { can } = usePermissions();
  const entry = useFinanceEntry(boardId, entryId ?? null);

  return (
    <FormGate
      allowed={can('finance.create') || (!!entryId && can('finance.view'))}
      pending={!!entryId && entry.isPending}
      missing={!!entryId && !entry.data}
      what="entry"
    >
      <FinanceFields
        boardId={boardId}
        entry={entry.data ?? null}
        initialKind={kind ?? 'EXPENSE'}
        initialEventId={eventId ?? null}
      />
    </FormGate>
  );
}

function FinanceFields({
  boardId,
  entry,
  initialKind,
  initialEventId,
}: {
  boardId: string;
  entry: FinanceEntryDto | null;
  initialKind: FinanceKind;
  initialEventId: string | null;
}) {
  const colors = useThemeColors();
  const { can } = usePermissions();
  const me = useMe(true);
  const board = useBoard(boardId);
  const shows = useEvents(boardId, { type: 'SHOW' });
  const create = useCreateFinanceEntry(boardId);
  const update = useUpdateFinanceEntry(boardId);
  const voidEntry = useVoidFinanceEntry(boardId);
  const leave = useLeaveForm();
  const ink = useWidgetInk(boardId, 'FINANCES');
  const myId = me.data?.user.id ?? '';

  const initial = {
    kind: entry?.kind ?? initialKind,
    amount: entry ? (entry.amountCents / 100).toFixed(2) : '',
    category: (entry?.category ?? categoriesFor(entry?.kind ?? initialKind)[0].key) as FinanceCategory,
    occurredOn: entry?.occurredOn ?? localDayISO(),
    description: entry?.description ?? '',
    counterparty: entry?.counterparty ?? '',
    eventId: entry?.eventId ?? initialEventId,
    handledById: entry?.handledById ?? BAND,
    expected: entry?.state === 'EXPECTED',
  };
  const [kind, setKind] = useState<FinanceKind>(initial.kind);
  const [amount, setAmount] = useState(initial.amount);
  const [category, setCategory] = useState<FinanceCategory>(initial.category);
  const [occurredOn, setOccurredOn] = useState(initial.occurredOn);
  const [description, setDescription] = useState(initial.description);
  const [counterparty, setCounterparty] = useState(initial.counterparty);
  const [eventId, setEventId] = useState<string | null>(initial.eventId);
  const [handledById, setHandledById] = useState(initial.handledById);
  const [expected, setExpected] = useState(initial.expected);

  const manages = can('finance.manage');
  const editable =
    !entry || (entry.state !== 'VOID' && (manages || entry.createdById === myId));
  const cents = parseMoneyToCents(amount);
  const dirty =
    kind !== initial.kind ||
    amount !== initial.amount ||
    category !== initial.category ||
    occurredOn !== initial.occurredOn ||
    description !== initial.description ||
    counterparty !== initial.counterparty ||
    eventId !== initial.eventId ||
    handledById !== initial.handledById ||
    expected !== initial.expected;

  const switchKind = (next: FinanceKind) => {
    setKind(next);
    setCategory(categoriesFor(next)[0].key);
    if (next === 'EXPENSE') setExpected(false);
  };

  const save = async () => {
    const fields = {
      kind,
      category,
      amountCents: cents ?? 0,
      occurredOn,
      description: description.trim(),
      counterparty: counterparty.trim() || null,
      eventId,
      handledById: handledById === BAND ? null : handledById,
      state: expected ? ('EXPECTED' as const) : ('SETTLED' as const),
    };
    if (entry) {
      await update.mutateAsync({ entryId: entry.id, dto: fields });
      return;
    }
    const created = await create.mutateAsync(fields);
    // Reopen as the saved entry rather than closing, so a receipt can go on.
    // Rejecting stops the form's own close; nothing was lost, it was saved.
    leave(() => router.replace(`/board/${boardId}/form/finance?id=${created.id}`));
    throw new Error('reopened');
  };

  const confirmVoid = () =>
    Alert.alert('Void this entry?', 'It stays in the history but stops counting.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Void',
        style: 'destructive',
        onPress: () =>
          void voidEntry.mutateAsync(entry!.id).then(() => leave(() => router.back())),
      },
    ]);

  const members = board.data?.members ?? [];
  const title = entry
    ? entry.kind === 'INCOME'
      ? 'Income'
      : 'Expense'
    : kind === 'INCOME'
      ? 'Log income'
      : 'Log an expense';

  return (
    <FormScreen
      title={title}
      dirty={editable && dirty}
      canSave={editable && cents !== null && cents > 0 && (dirty || !entry)}
      saving={create.isPending || update.isPending}
      onSave={save}
      postered
    >
      <FormPoster
        ink={ink}
        label={title}
        fieldLabel="What for"
        placeholder={kind === 'INCOME' ? 'Door split at The Echo' : 'New strings'}
        value={description}
        onChangeText={editable ? setDescription : () => undefined}
        maxLength={2000}
      />

      {entry?.state === 'VOID' && (
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          This entry was voided. It stays in the history but no longer counts.
        </PosterText>
      )}

      <View pointerEvents={editable ? 'auto' : 'none'} style={{ gap: spacing.md }}>
        {!entry && (
          <ChoiceChips<FinanceKind>
            label="Type"
            value={kind}
            onChange={switchKind}
            choices={[
              { value: 'EXPENSE', label: 'Expense' },
              { value: 'INCOME', label: 'Income' },
            ]}
          />
        )}

        <TextField
          label={`Amount (${board.data?.currency ?? 'USD'})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          autoFocus={!entry}
          error={amount !== '' && cents === null ? 'Enter an amount like 12.50' : null}
        />

        <PickOne
          label="Category"
          noneLabel={categoriesFor(kind)[0].label}
          options={categoriesFor(kind)
            .slice(1)
            .map((c) => ({ value: c.key, label: c.label }))}
          value={category === categoriesFor(kind)[0].key ? null : category}
          onChange={(value) =>
            setCategory((value ?? categoriesFor(kind)[0].key) as FinanceCategory)
          }
        />

        <DateField
          label="Date"
          mode="date"
          value={fromDay(occurredOn)}
          onChange={(date) => date && setOccurredOn(localDayISO(date))}
        />

        <TextField
          label={kind === 'INCOME' ? 'From' : 'Paid to'}
          value={counterparty}
          onChangeText={setCounterparty}
          placeholder={kind === 'INCOME' ? 'The Echo' : 'Guitar Center'}
          maxLength={200}
        />

        <PickOne
          label="Show"
          noneLabel="Not tied to a show"
          options={(shows.data ?? []).map((show) => ({
            value: show.id,
            label: show.title,
            meta: new Date(show.startsAt).toLocaleDateString(),
          }))}
          value={eventId}
          onChange={setEventId}
        />

        {manages ? (
          <ChoiceChips<string>
            label={kind === 'INCOME' ? 'Who has the money' : 'Who paid'}
            value={handledById}
            onChange={setHandledById}
            choices={[
              { value: BAND, label: 'Band account' },
              ...members.map((m) => ({ value: m.userId, label: m.displayName })),
            ]}
          />
        ) : (
          <ChoiceChips<string>
            label={kind === 'INCOME' ? 'Who has the money' : 'Who paid'}
            value={handledById === myId ? myId : BAND}
            onChange={setHandledById}
            choices={[
              { value: BAND, label: 'Band account' },
              { value: myId, label: 'I did' },
            ]}
          />
        )}

        {kind === 'INCOME' && (
          <ChoiceChips<'yes' | 'no'>
            label="Received"
            value={expected ? 'no' : 'yes'}
            onChange={(value) => setExpected(value === 'no')}
            choices={[
              { value: 'yes', label: 'In hand' },
              { value: 'no', label: 'Still owed' },
            ]}
          />
        )}
      </View>

      {entry && <TaskAttachments boardId={boardId} parent={{ financeEntryId: entry.id }} />}

      {entry && editable && (
        <Button
          title="Void entry"
          variant="destructive"
          size="sm"
          disabled={voidEntry.isPending}
          onPress={confirmVoid}
        />
      )}
    </FormScreen>
  );
}
