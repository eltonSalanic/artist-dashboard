"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useShowSettlement, usePermissions } from "@artist/api-client";
import { labelStyle } from "@/lib/label-style";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EntryDialog } from "./entry-dialog";
import { Amount } from "./finance-bits";

/** A show's money, inside the show: the net and each cut. */
export function ShowMoney({
  boardId,
  eventId,
}: {
  boardId: string;
  eventId: string;
}) {
  const { can } = usePermissions();
  const visible = can("finance.view");
  const settlement = useShowSettlement(boardId, visible ? eventId : null);
  const [logging, setLogging] = useState(false);

  if (!visible) return null;
  const data = settlement.data;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className={labelStyle}>Money</h3>
        <div className="flex gap-2">
          {can("finance.create") && (
            <Button variant="outline" size="sm" onClick={() => setLogging(true)}>
              <Plus data-icon="inline-start" />
              Add Expense/Income
            </Button>
          )}
        </div>
      </div>

      {!data ? (
        <Skeleton className="h-12" />
      ) : data.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing logged for this show yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span>Net</span>
            <Amount cents={data.netCents} currency={data.currency} className="font-medium" />
          </div>
          {data.expectedCents > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Still owed</span>
              <Amount cents={data.expectedCents} currency={data.currency} />
            </div>
          )}
          <Link href="/finances" className="text-xs underline-offset-2 hover:underline">
            Open the books
          </Link>
        </div>
      )}

      <EntryDialog
        boardId={boardId}
        open={logging}
        onOpenChange={setLogging}
        eventId={eventId}
        members={data?.members ?? []}
        currency={data?.currency ?? "USD"}
      />
    </section>
  );
}
