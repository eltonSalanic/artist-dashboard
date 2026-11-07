"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { formatMoney, type FinanceSummaryDto } from "@artist/shared";
import { usePayBackMember, usePermissions } from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { MemberHistory } from "./member-history";
import { Amount, memberNamer } from "./finance-bits";

/**
 * Who the band owes, all time. A member is owed only for expenses they paid
 * out of pocket, until an admin pays them back from the band fund.
 */
export function BalancesSection({
  boardId,
  summary,
}: {
  boardId: string;
  summary: FinanceSummaryDto;
}) {
  const { can } = usePermissions();
  const payBackAll = usePayBackMember(boardId);
  const [viewing, setViewing] = useState<string | null>(null);
  const name = memberNamer(summary.members);
  const manages = can("finance.manage");
  const { currency } = summary;

  const rows = summary.balances.members
    .filter((row) => row.paidCents > 0)
    .sort((a, b) => b.owedCents - a.owedCents || b.paidCents - a.paidCents);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who&apos;s owed</CardTitle>
        <CardDescription>
          What members paid for the band out of pocket and haven&apos;t been
          paid back. The band fund:{" "}
          <Amount cents={summary.balances.bandFundCents} currency={currency} />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && (
          <Empty>
            <EmptyDescription>
              Nobody has paid for anything out of pocket yet.
            </EmptyDescription>
          </Empty>
        )}
        <ul className="flex flex-col divide-y">
          {rows.map((row) => (
            <li key={row.userId} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Button
                  variant="link"
                  className="h-auto justify-start whitespace-normal p-0 text-left"
                  onClick={() => setViewing(row.userId)}
                  aria-label={`View expenses for ${name(row.userId)}`}
                >
                  {name(row.userId)}
                </Button>
                <div className="text-xs text-muted-foreground">
                  Paid {formatMoney(row.paidCents, currency)} · paid back{" "}
                  {formatMoney(row.paidBackCents, currency)}
                </div>
              </div>
              <div className="text-right">
                {row.owedCents > 0 ? (
                  <>
                    <Amount
                      cents={-row.owedCents}
                      currency={currency}
                      className="font-medium"
                    />
                    <div className="text-xs text-muted-foreground">
                      owed back
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Square</span>
                )}
              </div>
              {manages && row.owedCents > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={payBackAll.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Pay ${name(row.userId)} back ${formatMoney(row.owedCents, currency)} from the band fund?`,
                      )
                    ) {
                      payBackAll.mutate(row.userId);
                    }
                  }}
                >
                  <HandCoins data-icon="inline-start" />
                  Pay back all
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>

      {viewing && (
        <MemberHistory
          boardId={boardId}
          userId={viewing}
          memberName={name(viewing)}
          currency={currency}
          onClose={() => setViewing(null)}
        />
      )}
    </Card>
  );
}
