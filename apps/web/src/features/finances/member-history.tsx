"use client";

import { useFinanceEntries, usePayouts } from "@artist/api-client";
import { categoryLabel, formatMoney } from "@artist/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Amount, formatDay } from "./finance-bits";

export function MemberHistory({
  boardId,
  userId,
  memberName,
  currency,
  onClose,
}: {
  boardId: string;
  userId: string;
  memberName: string;
  currency: string;
  onClose: () => void;
}) {
  const entries = useFinanceEntries(boardId, { kind: "EXPENSE" });
  const payouts = usePayouts(boardId);
  const expenses = (entries.data ?? []).filter(
    (e) => e.handledById === userId && e.state === "SETTLED",
  );
  const payments = (payouts.data ?? []).filter((p) => p.userId === userId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{memberName}: expenses and payouts</DialogTitle>
          <DialogDescription>
            All-time expenses paid personally and recorded payments. Earnings
            shares also affect the amount owed.
          </DialogDescription>
        </DialogHeader>
        {entries.error || payouts.error ? (
          <div role="alert" className="flex flex-col gap-2">
            <p>Could not load member history.</p>
            <Button
              variant="outline"
              onClick={() => {
                void entries.refetch();
                void payouts.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : entries.isPending || payouts.isPending ? (
          <Skeleton className="h-48" />
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="font-medium">Expenses</h3>
              {expenses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No personal expenses recorded.
                </p>
              )}
              <ul className="divide-y">
                {expenses.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p>{e.description || categoryLabel(e.category)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDay(e.occurredOn)} · {categoryLabel(e.category)}
                      </p>
                      {e.note && (
                        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                          {e.note}
                        </p>
                      )}
                    </div>
                    <Amount
                      cents={-e.amountCents}
                      currency={currency}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="font-medium">Payouts</h3>
              {payments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No payments recorded.
                </p>
              )}
              <ul className="divide-y">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p>
                        {p.amountCents > 0
                          ? "Received from band"
                          : "Paid to band"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDay(p.paidOn)}
                      </p>
                      {p.note && (
                        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                          {p.note}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 tabular-nums">
                      {formatMoney(Math.abs(p.amountCents), currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
