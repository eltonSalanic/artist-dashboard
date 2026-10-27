"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import {
  categoriesFor,
  formatMoney,
  parseMoneyToCents,
  type FinanceEntryDto,
  type FinanceKind,
  type FinanceMemberRef,
} from "@artist/shared";
import {
  useCreateFinanceEntry,
  useEvents,
  usePermissions,
  useUpdateFinanceEntry,
  useVoidFinanceEntry,
} from "@artist/api-client";
import { useMe } from "@/lib/use-me";
import { TaskAttachments } from "@/features/comments/task-attachments";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { NONE, OptionSelect, todayISO } from "./finance-bits";

/**
 * Log or edit one line of the books. A new entry turns into the saved one in
 * place, so the receipt can go on straight after — the moment people have it
 * in their hand.
 */
export function EntryDialog({
  boardId,
  open,
  onOpenChange,
  entry,
  kind: initialKind = "EXPENSE",
  eventId: initialEventId,
  members,
  currency,
}: {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing this entry; omitted to log a new one. */
  entry?: FinanceEntryDto;
  kind?: FinanceKind;
  eventId?: string;
  members: FinanceMemberRef[];
  currency: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {open && (
          <EntryForm
            key={entry?.id ?? "new"}
            boardId={boardId}
            entry={entry}
            initialKind={initialKind}
            initialEventId={initialEventId}
            members={members}
            currency={currency}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  boardId,
  entry,
  initialKind,
  initialEventId,
  members,
  currency,
  onClose,
}: {
  boardId: string;
  entry?: FinanceEntryDto;
  initialKind: FinanceKind;
  initialEventId?: string;
  members: FinanceMemberRef[];
  currency: string;
  onClose: () => void;
}) {
  const { can } = usePermissions();
  const me = useMe(true);
  const myId = me.data?.user.id ?? "";
  const shows = useEvents(boardId, { type: "SHOW" });
  const create = useCreateFinanceEntry(boardId);
  const update = useUpdateFinanceEntry(boardId);
  const voidEntry = useVoidFinanceEntry(boardId);

  // Once a new entry is saved the form edits it, receipts and all.
  const [saved, setSaved] = useState<FinanceEntryDto | undefined>(entry);
  const [kind, setKind] = useState<FinanceKind>(entry?.kind ?? initialKind);
  const [amount, setAmount] = useState(
    entry ? (entry.amountCents / 100).toFixed(2) : "",
  );
  const [category, setCategory] = useState<string>(
    entry?.category ?? categoriesFor(initialKind)[0].key,
  );
  const [occurredOn, setOccurredOn] = useState(entry?.occurredOn ?? todayISO());
  const [description, setDescription] = useState(entry?.description ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [counterparty, setCounterparty] = useState(entry?.counterparty ?? "");
  const [eventId, setEventId] = useState(
    entry?.eventId ?? initialEventId ?? NONE,
  );
  const [handledById, setHandledById] = useState(entry?.handledById ?? NONE);
  const [expected, setExpected] = useState(entry?.state === "EXPECTED");

  const manages = can("finance.manage");
  const editable =
    !saved ||
    (saved.state !== "VOID" && (manages || saved.createdById === myId));
  const cents = parseMoneyToCents(amount);
  const valid = cents !== null && cents > 0 && /^\d{4}-\d{2}-\d{2}$/.test(occurredOn);
  const pending = create.isPending || update.isPending;

  const switchKind = (next: FinanceKind) => {
    setKind(next);
    setCategory(categoriesFor(next)[0].key);
    if (next === "EXPENSE") setExpected(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || pending || !editable) return;
    const fields = {
      kind,
      category: category as FinanceEntryDto["category"],
      amountCents: cents,
      occurredOn,
      description: description.trim(),
      note: note.trim(),
      counterparty: counterparty.trim() || null,
      eventId: eventId === NONE ? null : eventId,
      handledById: handledById === NONE ? null : handledById,
      state: expected ? ("EXPECTED" as const) : ("SETTLED" as const),
    };
    if (saved) {
      update.mutate(
        // The shared schema types `category` as the key union.
        { entryId: saved.id, dto: fields as never },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(fields as never, { onSuccess: (row) => setSaved(row) });
    }
  };

  const handlerOptions = [
    { value: NONE, label: "The band's account" },
    ...members.map((m) => ({ value: m.id, label: m.displayName })),
  ];
  const showOptions = [
    { value: NONE, label: "Not tied to a show" },
    ...(shows.data ?? []).map((s) => ({
      value: s.id,
      label: `${s.title} · ${new Date(s.startsAt).toLocaleDateString()}`,
    })),
  ];
  // A show picked from somewhere else may be outside the list just loaded.
  if (eventId !== NONE && !showOptions.some((o) => o.value === eventId)) {
    showOptions.push({ value: eventId, label: saved?.eventTitle ?? "This show" });
  }

  const justCreated = !entry && !!saved;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>
          {justCreated
            ? "Saved"
            : saved
              ? kind === "INCOME"
                ? "Income"
                : "Expense"
              : kind === "INCOME"
                ? "Log income"
                : "Log an expense"}
        </DialogTitle>
        <DialogDescription>
          {justCreated
            ? `${formatMoney(saved.amountCents, currency)} is in the books. Add a receipt if you have one.`
            : saved?.state === "VOID"
              ? "This entry was voided. It stays in the history but no longer counts."
              : "Amounts are split between members by the band's split."}
        </DialogDescription>
      </DialogHeader>

      {!justCreated && (
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          {!saved && (
            <div className="flex gap-1 rounded-full bg-muted/60 p-1">
              {(["EXPENSE", "INCOME"] as const).map((k) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={kind === k ? "default" : "ghost"}
                  className="flex-1 rounded-full"
                  onClick={() => switchKind(k)}
                >
                  {k === "INCOME" ? "Income" : "Expense"}
                </Button>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="entry-amount">Amount ({currency})</FieldLabel>
              <Input
                id="entry-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={amount !== "" && cents === null}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="entry-date">Date</FieldLabel>
              <Input
                id="entry-date"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="entry-category">Category</FieldLabel>
            <OptionSelect
              id="entry-category"
              value={category}
              onChange={setCategory}
              options={categoriesFor(kind).map((c) => ({
                value: c.key,
                label: c.label,
              }))}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="entry-description">What for</FieldLabel>
            <Input
              id="entry-description"
              autoFocus={!saved}
              maxLength={2000}
              placeholder={kind === "INCOME" ? "Door split" : "New strings"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="entry-note">Note</FieldLabel>
            <Textarea
              id="entry-note"
              maxLength={2000}
              placeholder="Optional details"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="entry-counterparty">
                {kind === "INCOME" ? "From" : "Paid to"}
              </FieldLabel>
              <Input
                id="entry-counterparty"
                maxLength={200}
                placeholder={kind === "INCOME" ? "The Echo" : "Guitar Center"}
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="entry-show">Show</FieldLabel>
              <OptionSelect
                id="entry-show"
                value={eventId}
                onChange={setEventId}
                options={showOptions}
              />
            </Field>
          </div>

          {manages ? (
            <Field>
              <FieldLabel htmlFor="entry-handled">
                {kind === "INCOME" ? "Who has the money" : "Who paid"}
              </FieldLabel>
              <OptionSelect
                id="entry-handled"
                value={handledById}
                onChange={setHandledById}
                options={handlerOptions}
              />
            </Field>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={handledById === myId}
                onCheckedChange={(checked) =>
                  setHandledById(checked === true ? myId : NONE)
                }
              />
              {kind === "INCOME"
                ? "I'm holding this cash for the band"
                : "I paid for this myself"}
            </label>
          )}

          {kind === "INCOME" && (
            <label className="flex items-center justify-between gap-2 text-sm">
              <span>
                Not received yet
                <span className="block text-xs text-muted-foreground">
                  Tracked as owed until you mark it received.
                </span>
              </span>
              <Switch checked={expected} onCheckedChange={setExpected} />
            </label>
          )}
        </fieldset>
      )}

      {saved && (
        <>
          <Separator />
          <TaskAttachments
            boardId={boardId}
            parent={{ financeEntryId: saved.id }}
          />
        </>
      )}

      <DialogFooter className="items-center">
        {saved && !justCreated && editable && (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-destructive"
            disabled={voidEntry.isPending}
            onClick={() => voidEntry.mutate(saved.id, { onSuccess: onClose })}
          >
            <Ban data-icon="inline-start" />
            Void
          </Button>
        )}
        {justCreated ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              {editable ? "Cancel" : "Close"}
            </Button>
            {editable && (
              <Button type="submit" disabled={!valid || pending}>
                {pending ? "Saving…" : saved ? "Save" : "Add to the books"}
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </form>
  );
}
