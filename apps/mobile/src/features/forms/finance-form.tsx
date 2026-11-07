import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import {
  canEditEntry,
  categoriesFor,
  formatMoney,
  localDayISO,
  parseMoneyToCents,
  paybackStatus,
  type FinanceCategory,
  type FinanceEntryDto,
  type FinanceKind,
} from '@artist/shared';
import {
  uploadAttachment,
  useBoard,
  useCreateFinanceEntry,
  useEvents,
  useFinanceEntry,
  useMe,
  usePayBackFinanceEntry,
  usePermissions,
  useUndoPayBackFinanceEntry,
  useUpdateFinanceEntry,
  useVoidFinanceEntry,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { DateField } from '@/components/date-field';
import { PickOne } from '@/components/pick-one';
import { PosterText } from '@/components/poster-text';
import { TextField } from '@/components/text-field';
import type { TextInput } from '@/components/text-input';
import { TaskAttachments } from '@/features/attachments/task-attachments';
import { DraftReceipt } from '@/features/attachments/draft-receipt';
import type { PickedUpload } from '@/features/attachments/pick';
import { useWidgetInk } from '@/features/board/spoke-header';
import { PaybackLabel } from '@/features/finances/payback-label';
import { shortDate } from '@/features/board/format';
import { spacing, useThemeColors } from '@/theme';
import { FormGate } from './form-gate';
import { FormPoster } from './form-poster';
import { FormScreen, useLeaveForm } from './form-screen';
import { useRequiredFields } from './required-fields';
import { saveFinanceDraft, type FinanceDraftProgress } from './save-finance-draft';

const BAND = '__band__';

const fromDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * One line of the band's books. Saving returns to the previous screen;
 * a selected receipt uploads after creation and before closing.
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
  const payBack = usePayBackFinanceEntry(boardId);
  const undoPayBack = useUndoPayBackFinanceEntry(boardId);
  const voidEntry = useVoidFinanceEntry(boardId);
  const queryClient = useQueryClient();
  const progress = useRef<FinanceDraftProgress>({ entryId: entry?.id });
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<PickedUpload | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const ink = useWidgetInk(boardId, 'FINANCES');
  const myId = me.data?.user.id ?? '';

  const initial = {
    kind: entry?.kind ?? initialKind,
    amount: entry ? (entry.amountCents / 100).toFixed(2) : '',
    category: (entry?.category ??
      categoriesFor(entry?.kind ?? initialKind)[0].key) as FinanceCategory,
    occurredOn: entry?.occurredOn ?? localDayISO(),
    description: entry?.description ?? '',
    note: entry?.note ?? '',
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
  const [note, setNote] = useState(initial.note);
  const [counterparty, setCounterparty] = useState(initial.counterparty);
  const [eventId, setEventId] = useState<string | null>(initial.eventId);
  const [handledById, setHandledById] = useState(initial.handledById);
  const [expected, setExpected] = useState(initial.expected);

  const manages = can('finance.manage');
  // Admins, or the member who paid; nobody once it's paid back.
  const editable =
    !entry ||
    (entry.state !== 'VOID' && can('finance.create') && canEditEntry(entry, myId, manages));
  const payback = entry ? paybackStatus(entry) : null;
  const cents = parseMoneyToCents(amount);
  const dirty =
    receipt !== null ||
    kind !== initial.kind ||
    amount !== initial.amount ||
    category !== initial.category ||
    occurredOn !== initial.occurredOn ||
    description !== initial.description ||
    note !== initial.note ||
    counterparty !== initial.counterparty ||
    eventId !== initial.eventId ||
    handledById !== initial.handledById ||
    expected !== initial.expected;

  const amountInput = useRef<TextInput>(null);
  const required = useRequiredFields([
    {
      name: 'amount',
      ref: amountInput,
      missing: cents === null || cents <= 0,
      message: amount.trim() === '' ? 'Add an amount' : 'Enter an amount like 12.50',
    },
  ]);

  const switchKind = (next: FinanceKind) => {
    setKind(next);
    setCategory(categoriesFor(next)[0].key);
    if (next === 'EXPENSE') setExpected(false);
  };

  const save = async () => {
    if (savingRef.current) throw new Error('Save already in progress');
    savingRef.current = true;
    setSaving(true);
    setReceiptError(null);
    try {
      const fields = {
        kind,
        category,
        amountCents: cents ?? 0,
        occurredOn,
        description: description.trim(),
        note: note.trim(),
        counterparty: counterparty.trim() || null,
        eventId,
        // Income goes to the band; only an expense can be owed back.
        handledById: kind === 'EXPENSE' && handledById !== BAND ? handledById : null,
        state: expected ? ('EXPECTED' as const) : ('SETTLED' as const),
      };
      await saveFinanceDraft(progress.current, fields, receipt?.source ?? null, {
        create: (dto) => create.mutateAsync(dto),
        update: (entryId, dto) => update.mutateAsync({ entryId, dto }),
        upload: async (entryId, source) => {
          try {
            await uploadAttachment(boardId, { financeEntryId: entryId }, source);
          } catch (error) {
            setReceiptError(
              'Entry saved, but the receipt could not upload. Tap Save to retry, or remove the receipt and save to finish.',
            );
            throw error;
          }
        },
      });
      if (receipt) {
        setReceipt(null);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['finances', boardId] }),
          queryClient.invalidateQueries({ queryKey: ['attachments', boardId] }),
          queryClient.invalidateQueries({ queryKey: ['activity', boardId] }),
        ]);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const members = board.data?.members ?? [];
  const currency = board.data?.currency ?? 'USD';
  const memberName = (userId: string) =>
    userId === myId
      ? 'you'
      : (members.find((m) => m.userId === userId)?.displayName ?? 'a former member');
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
      canSave={editable && (dirty || !entry)}
      required={editable ? required : undefined}
      saving={saving}
      onSave={save}
      postered
    >
      <View pointerEvents={saving ? 'none' : 'auto'} style={{ gap: spacing.lg }}>
        <FormPoster
          boardId={boardId}
          ink={ink}
          label={title}
          fieldLabel="What for"
          placeholder={kind === 'INCOME' ? 'Door split at The Echo' : 'New strings'}
          value={description}
          onChangeText={editable ? setDescription : () => undefined}
          autoFocus={!entry}
          maxLength={2000}
        />

        {entry?.state === 'VOID' && (
          <PosterText variant="cardMeta" color={colors.mutedForeground}>
            This entry was voided. It stays in the history but no longer counts.
          </PosterText>
        )}
        {entry && payback && entry.handledById && (
          <View
            accessibilityRole="summary"
            style={{
              gap: spacing.xs,
              padding: spacing.sm + 2,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: colors.muted,
            }}
          >
            <PaybackLabel status={payback} />
            <PosterText variant="paragraph" color={colors.foreground}>
              {payback === 'owed'
                ? `${capital(memberName(entry.handledById))} paid for this out of pocket. The band owes ${entry.handledById === myId ? 'you' : 'them'} ${formatMoney(entry.amountCents, currency)}.`
                : `Paid back to ${memberName(entry.handledById)}${entry.paidBackAt ? paidWhen(entry.paidBackAt) : ''}${
                    entry.paidBackById
                      ? ` by ${entry.paidBackById === myId ? 'you' : memberName(entry.paidBackById)}`
                      : ''
                  }.`}
            </PosterText>
            {payback === 'paid' && (
              <PosterText variant="cardMeta" color={colors.mutedForeground}>
                {manages
                  ? 'It’s locked so it can’t drift from what was paid. Undo the payback to change it.'
                  : 'It’s locked now. An admin can undo the payback if something needs changing.'}
              </PosterText>
            )}
          </View>
        )}

        {entry && !editable && entry.state !== 'VOID' && payback !== 'paid' && (
          <PosterText variant="cardMeta" color={colors.mutedForeground}>
            {entry.handledById
              ? `Only an admin or ${memberName(entry.handledById)} can change this.`
              : 'Only an admin or whoever logged it can change this.'}
          </PosterText>
        )}

        <View pointerEvents={editable ? 'auto' : 'none'} style={{ gap: spacing.xl }}>
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

          {kind === 'INCOME' ? null : manages ? (
            <ChoiceChips<string>
              label="Who paid"
              hint="If a member paid out of pocket, the band owes it back to them until an admin pays them back."
              value={handledById}
              onChange={setHandledById}
              choices={[
                { value: BAND, label: 'Band account' },
                ...members.map((m) => ({ value: m.userId, label: m.displayName })),
              ]}
            />
          ) : (
            <ChoiceChips<string>
              label="Who paid"
              hint="If you paid out of pocket, the band owes it back to you until an admin pays you back."
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
              hint="Still owed is promised money that hasn’t been paid yet."
              value={expected ? 'no' : 'yes'}
              onChange={(value) => setExpected(value === 'no')}
              choices={[
                { value: 'yes', label: 'In hand' },
                { value: 'no', label: 'Still owed' },
              ]}
            />
          )}

          <TextField
            label={`Amount (${board.data?.currency ?? 'USD'})`}
            value={amount}
            ref={amountInput}
            required
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            error={
              required.error('amount') ??
              (amount !== '' && cents === null ? 'Enter an amount like 12.50' : null)
            }
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
            hint="File it under a show to see what that show made or cost."
            noneLabel="Not tied to a show"
            options={(shows.data ?? []).map((show) => ({
              value: show.id,
              label: show.title,
              meta: new Date(show.startsAt).toLocaleDateString(),
            }))}
            value={eventId}
            onChange={setEventId}
          />

          <TextField
            label="Note"
            value={note}
            onChangeText={editable ? setNote : () => undefined}
            placeholder="Optional details"
            multiline
            maxLength={2000}
            textAlignVertical="top"
            style={{ minHeight: 96 }}
          />
        </View>

        {entry && <TaskAttachments boardId={boardId} parent={{ financeEntryId: entry.id }} />}

        {!entry && can('file.upload') && (
          <DraftReceipt receipt={receipt} onChange={setReceipt} disabled={saving} />
        )}
        {receiptError && (
          <PosterText variant="cardMeta" color={colors.destructive} accessibilityRole="alert">
            {receiptError}
          </PosterText>
        )}

        {entry && manages && payback === 'owed' && entry.handledById && (
          <PayBackButton
            label={`Pay ${entry.handledById === myId ? 'yourself' : memberName(entry.handledById)} back ${formatMoney(entry.amountCents, currency)}`}
            // Paying back locks the entry, so unsaved edits would be lost.
            disabled={payBack.isPending || dirty}
            hint={
              dirty ? 'Save your changes first.' : 'Comes out of the band fund. You can undo it.'
            }
            onPayBack={() => payBack.mutate(entry.id)}
          />
        )}
        {entry && manages && payback === 'paid' && (
          <Button
            title="Undo pay back"
            variant="secondary"
            size="sm"
            disabled={undoPayBack.isPending}
            onPress={() =>
              Alert.alert(
                'Undo this payback?',
                'The band will owe it again, and the expense can be edited.',
                [
                  { text: 'Keep it', style: 'cancel' },
                  { text: 'Undo', onPress: () => undoPayBack.mutate(entry.id) },
                ],
              )
            }
          />
        )}
        {entry && editable && (
          <VoidEntryButton
            disabled={voidEntry.isPending}
            onVoid={() => voidEntry.mutateAsync(entry.id)}
          />
        )}
      </View>
    </FormScreen>
  );
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function PayBackButton({
  label,
  hint,
  disabled,
  onPayBack,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onPayBack: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: spacing.xs }}>
      <Button title={label} disabled={disabled} onPress={onPayBack} />
      <PosterText variant="cardMeta" color={colors.mutedForeground} style={{ textAlign: 'center' }}>
        {hint}
      </PosterText>
    </View>
  );
}

function VoidEntryButton({
  disabled,
  onVoid,
}: {
  disabled: boolean;
  onVoid: () => Promise<unknown>;
}) {
  const leave = useLeaveForm();
  return (
    <Button
      title="Void entry"
      variant="destructive"
      size="sm"
      disabled={disabled}
      onPress={() =>
        Alert.alert('Void this entry?', 'It stays in the history but stops counting.', [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Void',
            style: 'destructive',
            onPress: () => void onVoid().then(() => leave(() => router.back())),
          },
        ])
      }
    />
  );
}

/** " today", " yesterday" or " on 3 Nov", to follow "Paid back to …". */
function paidWhen(iso: string): string {
  const day = shortDate(iso);
  return day === 'Today' || day === 'Yesterday' ? ` ${day.toLowerCase()}` : ` on ${day}`;
}
