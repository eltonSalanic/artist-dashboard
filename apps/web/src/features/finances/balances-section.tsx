"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import {
  formatMoney,
  parseMoneyToCents,
  type FinanceSummaryDto,
} from "@artist/shared";
import {
  useCreatePayout,
  useDeletePayout,
  usePayouts,
  usePermissions,
} from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Amount, formatDay, memberNamer, todayISO } from "./finance-bits";

/**
 * Who is owed what, all time. Positive means the band owes them; a payment
 * recorded here is money that changed hands outside the app.
 */
export function BalancesSection({
  boardId,
  summary,
}: {
  boardId: string;
  summary: FinanceSummaryDto;
}) {
  const { can } = usePermissions();
  const payouts = usePayouts(boardId);
  const deletePayout = useDeletePayout(boardId);
  const [paying, setPaying] = useState<{ userId: string; cents: number } | null>(
    null,
  );
  const name = memberNamer(summary.members);
  const manages = can("finance.manage");
  const { currency } = summary;

  // Everyone on the board shows, even before any money touched them.
  const rows = summary.members.map(
    (m) =>
      summary.balances.members.find((b) => b.userId === m.id) ?? {
        userId: m.id,
        shareCents: 0,
        frontedCents: 0,
        collectedCents: 0,
        paidOutCents: 0,
        balanceCents: 0,
      },
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Balances</CardTitle>
          <CardDescription>
            Each member&apos;s cut, plus what they fronted, minus cash they
            hold and what they&apos;ve been paid. Band fund:{" "}
            <Amount cents={summary.balances.bandFundCents} currency={currency} />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {rows.map((row) => (
              <li key={row.userId} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{name(row.userId)}</div>
                  <div className="text-xs text-muted-foreground">
                    Cut {formatMoney(row.shareCents, currency)} · fronted{" "}
                    {formatMoney(row.frontedCents, currency)} · holding{" "}
                    {formatMoney(row.collectedCents, currency)} · paid{" "}
                    {formatMoney(row.paidOutCents, currency)}
                  </div>
                </div>
                <div className="text-right">
                  <Amount
                    cents={row.balanceCents}
                    currency={currency}
                    className="font-medium"
                  />
                  <div className="text-xs text-muted-foreground">
                    {row.balanceCents > 0
                      ? "band owes them"
                      : row.balanceCents < 0
                        ? "owes the band"
                        : "settled up"}
                  </div>
                </div>
                {manages && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPaying({ userId: row.userId, cents: row.balanceCents })
                    }
                  >
                    <HandCoins data-icon="inline-start" />
                    Record payment
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Money paid between the band and members.</CardDescription>
        </CardHeader>
        <CardContent>
          {(payouts.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {(payouts.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {p.amountCents > 0
                      ? `Paid ${name(p.userId)}`
                      : `${name(p.userId)} paid the band`}
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDay(p.paidOn)}
                      {p.note ? ` · ${p.note}` : ""}
                    </div>
                  </div>
                  <span className="tabular-nums">
                    {formatMoney(Math.abs(p.amountCents), currency)}
                  </span>
                  {manages && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={deletePayout.isPending}
                      onClick={() => deletePayout.mutate(p.id)}
                    >
                      Undo
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {paying && (
        <PayoutDialog
          boardId={boardId}
          memberName={name(paying.userId)}
          userId={paying.userId}
          balanceCents={paying.cents}
          currency={currency}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}

function PayoutDialog({
  boardId,
  userId,
  memberName,
  balanceCents,
  currency,
  onClose,
}: {
  boardId: string;
  userId: string;
  memberName: string;
  balanceCents: number;
  currency: string;
  onClose: () => void;
}) {
  const create = useCreatePayout(boardId);
  // Default to clearing the balance, in whichever direction it runs.
  const [toBand, setToBand] = useState(balanceCents < 0);
  const [amount, setAmount] = useState(
    balanceCents !== 0 ? (Math.abs(balanceCents) / 100).toFixed(2) : "",
  );
  const [paidOn, setPaidOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const cents = parseMoneyToCents(amount);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cents) return;
    create.mutate(
      {
        userId,
        amountCents: toBand ? -cents : cents,
        paidOn,
        note: note.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              For money that already changed hands, by cash, Venmo or bank
              transfer. Band Wall doesn&apos;t move money itself.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-1 rounded-full bg-muted/60 p-1">
            <Button
              type="button"
              size="sm"
              variant={!toBand ? "default" : "ghost"}
              className="flex-1 rounded-full"
              onClick={() => setToBand(false)}
            >
              Band paid {memberName}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={toBand ? "default" : "ghost"}
              className="flex-1 rounded-full"
              onClick={() => setToBand(true)}
            >
              {memberName} paid the band
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payout-amount">Amount ({currency})</FieldLabel>
              <Input
                id="payout-amount"
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payout-date">Date</FieldLabel>
              <Input
                id="payout-date"
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="payout-note">Note</FieldLabel>
            <Input
              id="payout-note"
              maxLength={500}
              placeholder="Venmo, Oct shows"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!cents || create.isPending}>
              {create.isPending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
