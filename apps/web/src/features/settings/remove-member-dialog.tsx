"use client";

import { useState } from "react";
import { formatMoney } from "@artist/shared";
import {
  useFinanceSummary,
  usePermissions,
  useRemoveMember,
} from "@artist/api-client";
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
import { Skeleton } from "@/components/ui/skeleton";
import { todayISO } from "@/features/finances/finance-bits";

/**
 * Removing a member, with what happens to their money. Their past entries
 * always stay. The admin chooses whether to record a final payment that
 * squares them up.
 */
export function RemoveMemberDialog({
  boardId,
  member,
  onOpenChange,
}: {
  boardId: string;
  member: { userId: string; displayName: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {member && (
          <RemoveMemberForm
            key={member.userId}
            boardId={boardId}
            member={member}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RemoveMemberForm({
  boardId,
  member,
  onClose,
}: {
  boardId: string;
  member: { userId: string; displayName: string };
  onClose: () => void;
}) {
  const { can } = usePermissions();
  const seesBooks = can("finance.view");
  const summary = useFinanceSummary(boardId, {}, seesBooks);
  const remove = useRemoveMember(boardId);

  const [payOut, setPayOut] = useState(true);

  const name = member.displayName;
  const balance =
    summary.data?.balances.members.find((m) => m.userId === member.userId)
      ?.balanceCents ?? 0;
  const currency = summary.data?.currency ?? "USD";
  const loading = seesBooks && summary.isPending;

  const submit = () =>
    remove.mutate(
      {
        userId: member.userId,
        dto: {
          ...(payOut && balance !== 0
            ? {
                payout: {
                  amountCents: balance,
                  paidOn: todayISO(),
                  note: `Final payment when ${name} left the band`,
                },
              }
            : {}),
        },
      },
      { onSuccess: onClose },
    );

  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Remove {name}?</DialogTitle>
        <DialogDescription>
          They&apos;ll lose access to this band and be unassigned from all its
          tasks. Their past entries in the books stay as they are.
        </DialogDescription>
      </DialogHeader>

      {loading && <Skeleton className="h-24" />}

      {!loading && seesBooks && balance !== 0 && (
        <section className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {balance > 0
              ? `The band owes ${name} ${formatMoney(balance, currency)}`
              : `${name} owes the band ${formatMoney(-balance, currency)}`}
          </p>
          <label className="flex items-start gap-2">
            <Checkbox
              checked={payOut}
              onCheckedChange={(checked) => setPayOut(checked === true)}
              className="mt-0.5"
            />
            <span>
              {balance > 0
                ? "Record that we paid them now"
                : "Record that they paid the band now"}
              <span className="block text-xs text-muted-foreground">
                Untick to leave it open. They stay in &quot;Who&apos;s
                owed&quot; until someone records the payment.
              </span>
            </span>
          </label>
        </section>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={loading || remove.isPending}
          onClick={submit}
        >
          {remove.isPending ? "Removing…" : `Remove ${name}`}
        </Button>
      </DialogFooter>
    </div>
  );
}
