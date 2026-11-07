"use client";

import {
  useFinanceEntries,
  usePayBackFinanceEntry,
  usePermissions,
  useUndoPayBackFinanceEntry,
} from "@artist/api-client";
import { categoryLabel, formatMoney, paybackStatus } from "@artist/shared";
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
import { PaybackBadge } from "./payback-badge";

/** Every expense a member paid out of pocket, and whether it's paid back. */
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
  const { can } = usePermissions();
  const manages = can("finance.manage");
  const entries = useFinanceEntries(boardId, { kind: "EXPENSE" });
  const payBack = usePayBackFinanceEntry(boardId);
  const undo = useUndoPayBackFinanceEntry(boardId);
  const expenses = (entries.data ?? []).filter(
    (e) => e.handledById === userId && e.state === "SETTLED",
  );
  const owed = expenses
    .filter((e) => !e.paidBackAt)
    .reduce((sum, e) => sum + e.amountCents, 0);
  const paid = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{memberName}: expenses</DialogTitle>
          <DialogDescription>
            Paid {formatMoney(paid, currency)} for the band out of pocket ·
            paid back {formatMoney(paid - owed, currency)} · still owed{" "}
            {formatMoney(owed, currency)}.
          </DialogDescription>
        </DialogHeader>
        {entries.error ? (
          <div role="alert" className="flex flex-col gap-2">
            <p>Could not load their expenses.</p>
            <Button variant="outline" onClick={() => void entries.refetch()}>
              Try again
            </Button>
          </div>
        ) : entries.isPending ? (
          <Skeleton className="h-48" />
        ) : expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No out-of-pocket expenses recorded.
          </p>
        ) : (
          <ul className="divide-y">
            {expenses.map((e) => {
              const status = paybackStatus(e);
              return (
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Amount cents={-e.amountCents} currency={currency} />
                    <PaybackBadge entry={e} />
                    {manages && status === "owed" && (
                      <Button
                        size="xs"
                        variant="outline"
                        disabled={payBack.isPending}
                        onClick={() => payBack.mutate(e.id)}
                      >
                        Pay back
                      </Button>
                    )}
                    {manages && status === "paid" && (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={undo.isPending}
                        onClick={() => undo.mutate(e.id)}
                      >
                        Undo
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
