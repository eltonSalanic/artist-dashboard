"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  categoriesFor,
  categoryLabel,
  parseMoneyToCents,
  showSettlement,
  type FinanceCategory,
  type FinanceKind,
  type LedgerEntry,
  type ShowSettlementDto,
} from "@artist/shared";
import { useSettleShow, useShowSettlement } from "@artist/api-client";
import { labelStyle } from "@/lib/label-style";
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Amount,
  NONE,
  OptionSelect,
  formatDay,
  memberNamer,
  todayISO,
} from "./finance-bits";

interface Line {
  key: number;
  kind: FinanceKind;
  category: FinanceCategory;
  amount: string;
  description: string;
  handledById: string;
}

let nextKey = 0;
const newLine = (kind: FinanceKind, category: FinanceCategory): Line => ({
  key: nextKey++,
  kind,
  category,
  amount: "",
  description: "",
  handledById: NONE,
});

/**
 * The night's money in one pass: the fee, the merch take, what it cost, and a
 * live preview of everyone's cut before anything is saved.
 */
export function SettleShowDialog({
  boardId,
  eventId,
  open,
  onOpenChange,
}: {
  boardId: string;
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settlement = useShowSettlement(boardId, open ? eventId : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {!open ? null : settlement.data ? (
          <SettleForm
            boardId={boardId}
            data={settlement.data}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <Skeleton className="h-80" />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettleForm({
  boardId,
  data,
  onClose,
}: {
  boardId: string;
  data: ShowSettlementDto;
  onClose: () => void;
}) {
  const settle = useSettleShow(boardId);
  const name = memberNamer(data.members);
  const hasFee = data.entries.some((e) => e.category === "SHOW_FEE");

  const [occurredOn, setOccurredOn] = useState(() => {
    const day = todayISO(new Date(data.event.startsAt));
    return day > todayISO() ? todayISO() : day;
  });
  const [received, setReceived] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState<Line[]>(() => [
    ...(hasFee ? [] : [newLine("INCOME", "SHOW_FEE")]),
    newLine("INCOME", "MERCH_SALES"),
    newLine("EXPENSE", "TRAVEL"),
  ]);

  const patch = (key: number, change: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...change } : l)));

  const filled = lines
    .map((l) => ({ ...l, cents: parseMoneyToCents(l.amount) }))
    .filter((l) => l.amount.trim() !== "");
  const invalid = filled.some((l) => l.cents === null || l.cents === 0);
  const ready = filled.filter(
    (l): l is typeof l & { cents: number } => l.cents !== null && l.cents > 0,
  );

  // What the books would hold after saving: what's there, what's arriving.
  const preview = showSettlement([
    ...data.entries.map(
      (e): LedgerEntry => ({
        ...e,
        state: received.has(e.id) ? "SETTLED" : e.state,
      }),
    ),
    ...ready.map(
      (l): LedgerEntry => ({
        kind: l.kind,
        state: "SETTLED",
        amountCents: l.cents,
        category: l.category,
        occurredOn,
        handledById: l.handledById === NONE ? null : l.handledById,
        splits: data.split,
      }),
    ),
  ]);

  const canSave =
    !invalid && (ready.length > 0 || received.size > 0) && !settle.isPending;

  const submit = () =>
    settle.mutate(
      {
        eventId: data.event.id,
        dto: {
          occurredOn,
          receivedIds: [...received],
          lines: ready.map((l) => ({
            kind: l.kind,
            category: l.category,
            amountCents: l.cents,
            description: l.description.trim() || undefined,
            handledById: l.handledById === NONE ? null : l.handledById,
          })),
        },
      },
      { onSuccess: onClose },
    );

  const handlerOptions = [
    { value: NONE, label: "Band account" },
    ...data.members.map((m) => ({ value: m.id, label: m.displayName })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Settle {data.event.title}</DialogTitle>
        <DialogDescription>
          Enter what came in and what it cost. Everything is split by the
          band&apos;s split and filed against this show.
        </DialogDescription>
      </DialogHeader>

      {data.entries.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className={labelStyle}>Already in the books</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {data.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                {e.state === "EXPECTED" ? (
                  <label className="flex flex-1 items-center gap-2">
                    <Checkbox
                      checked={received.has(e.id)}
                      onCheckedChange={(checked) =>
                        setReceived((prev) => {
                          const next = new Set(prev);
                          if (checked === true) next.add(e.id);
                          else next.delete(e.id);
                          return next;
                        })
                      }
                    />
                    <span className="flex-1">
                      {e.description || categoryLabel(e.category)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        owed · tick when it arrives
                      </span>
                    </span>
                  </label>
                ) : (
                  <span className="flex-1">
                    {e.description || categoryLabel(e.category)}
                  </span>
                )}
                <Amount
                  cents={e.kind === "INCOME" ? e.amountCents : -e.amountCents}
                  currency={data.currency}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className={labelStyle}>Tonight</h3>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Date
            <Input
              type="date"
              className="h-7 w-36"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
            />
          </label>
        </div>
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li
              key={line.key}
              className="grid grid-cols-[1fr_6rem_auto] gap-2 sm:grid-cols-[10rem_1fr_6rem_9rem_auto]"
            >
              <OptionSelect
                size="sm"
                value={line.category}
                onChange={(v) => patch(line.key, { category: v as FinanceCategory })}
                options={categoriesFor(line.kind).map((c) => ({
                  value: c.key,
                  label: c.label,
                }))}
              />
              <Input
                className="hidden h-7 sm:block"
                placeholder="Note"
                value={line.description}
                onChange={(e) => patch(line.key, { description: e.target.value })}
              />
              <Input
                className="h-7 text-right"
                inputMode="decimal"
                placeholder={line.kind === "INCOME" ? "+0.00" : "−0.00"}
                aria-label={`${categoryLabel(line.category)} amount`}
                aria-invalid={
                  line.amount.trim() !== "" &&
                  !parseMoneyToCents(line.amount)
                }
                value={line.amount}
                onChange={(e) => patch(line.key, { amount: e.target.value })}
              />
              <OptionSelect
                size="sm"
                className="hidden sm:flex"
                value={line.handledById}
                onChange={(v) => patch(line.key, { handledById: v })}
                options={handlerOptions}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove line"
                onClick={() =>
                  setLines((prev) => prev.filter((l) => l.key !== line.key))
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLines((prev) => [...prev, newLine("INCOME", "OTHER_INCOME")])
            }
          >
            <Plus data-icon="inline-start" />
            Income
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setLines((prev) => [...prev, newLine("EXPENSE", "OTHER_EXPENSE")])
            }
          >
            <Plus data-icon="inline-start" />
            Cost
          </Button>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-2 text-sm">
        <h3 className={labelStyle}>The split</h3>
        <div className="flex justify-between">
          <span>In</span>
          <Amount cents={preview.incomeCents} currency={data.currency} />
        </div>
        <div className="flex justify-between">
          <span>Costs</span>
          <Amount cents={-preview.expenseCents} currency={data.currency} />
        </div>
        <div className="flex justify-between font-medium">
          <span>Net</span>
          <Amount cents={preview.netCents} currency={data.currency} />
        </div>
        <ul className="mt-1 grid gap-1 sm:grid-cols-2">
          {data.split.map((share) => {
            const cut =
              share.userId === null
                ? preview.bandFundCents
                : (preview.cuts.find((c) => c.userId === share.userId)?.cents ??
                  0);
            return (
              <li
                key={share.userId ?? "fund"}
                className="flex justify-between rounded-md bg-muted/50 px-2 py-1"
              >
                <span>
                  {name(share.userId)}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {(share.shareBps / 100).toFixed(share.shareBps % 100 ? 2 : 0)}%
                  </span>
                </span>
                <Amount cents={cut} currency={data.currency} />
              </li>
            );
          })}
        </ul>
        {preview.expectedCents > 0 && (
          <p className="text-xs text-muted-foreground">
            Still owed for this show, not counted above:{" "}
            <Amount cents={preview.expectedCents} currency={data.currency} />
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Show on {formatDay(todayISO(new Date(data.event.startsAt)))}. Who
          physically holds the cash goes on each line, so balances stay right.
        </p>
      </section>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" disabled={!canSave} onClick={submit}>
          {settle.isPending ? "Saving…" : "Settle show"}
        </Button>
      </DialogFooter>
    </div>
  );
}
