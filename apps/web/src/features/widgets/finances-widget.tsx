"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { categoryLabel } from "@artist/shared";
import {
  useFinanceEntries,
  useFinanceSummary,
  usePermissions,
} from "@artist/api-client";
import { useMe } from "@/lib/use-me";
import {
  Amount,
  formatDay,
  periodRange,
} from "@/features/finances/finance-bits";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** This month at a glance: the net, the band fund, and what you're owed. */
export function FinancesWidget({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const me = useMe(true);
  const visible = can("finance.view");
  const summary = useFinanceSummary(boardId, periodRange("month"), visible);

  if (!visible) {
    return (
      <p className="text-sm text-muted-foreground">
        Only admins can see the band&apos;s books.
      </p>
    );
  }
  if (!summary.data) return <Skeleton className="h-full min-h-24" />;

  const { totals, balances, currency, unpaidShows } = summary.data;
  const mine =
    balances.members.find((m) => m.userId === me.data?.user.id)?.balanceCents ??
    0;

  return (
    <div className="flex h-full flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Net this month</dt>
          <dd className="text-lg font-semibold">
            <Amount cents={totals.netCents} currency={currency} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Band owes you</dt>
          <dd className="text-lg font-semibold">
            <Amount cents={Math.max(0, mine)} currency={currency} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Band fund</dt>
          <dd>
            <Amount cents={balances.bandFundCents} currency={currency} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Unpaid shows</dt>
          <dd className="tabular-nums">{unpaidShows.length}</dd>
        </div>
      </dl>
      <Button
        variant="outline"
        size="sm"
        className="mt-auto self-start"
        nativeButton={false}
        render={<Link href="/finances" />}
      >
        <Wallet data-icon="inline-start" />
        Open finances
      </Button>
    </div>
  );
}

export function FinancesWidgetExpanded({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const entries = useFinanceEntries(boardId, periodRange("month"));
  const summary = useFinanceSummary(boardId, periodRange("month"));
  const currency = summary.data?.currency ?? "USD";

  return (
    <div className="flex flex-col gap-4">
      <FinancesWidget boardId={boardId} />
      {can("finance.view") && (
        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide">
            This month
          </h3>
          {entries.isPending ? (
            <Skeleton className="h-24" />
          ) : (entries.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {(entries.data ?? []).slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-muted-foreground">
                    {formatDay(e.occurredOn)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {e.description || categoryLabel(e.category)}
                  </span>
                  <Amount
                    cents={e.kind === "INCOME" ? e.amountCents : -e.amountCents}
                    currency={currency}
                    signed
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
