"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Minus,
  Paperclip,
  Plus,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  DEFAULT_FINANCE_FILTERS,
  FINANCE_CATEGORIES,
  FINANCE_SORTS,
  filterFinanceEntries,
  type FinanceSort,
  categoryLabel,
  financeCsv,
  formatMoney,
  ledgerTotals,
  type FinanceEntryDto,
  type FinanceKind,
  type FinanceSummaryDto,
} from "@artist/shared";
import {
  useApproveFinanceEntry,
  useFinanceEntries,
  useFinanceSummary,
  usePermissions,
  useRejectFinanceEntry,
} from "@artist/api-client";
import { useMe } from "@/lib/use-me";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { relativeTime } from "@/features/comments/comment-bits";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BalancesSection } from "./balances-section";
import { EntryDialog } from "./entry-dialog";
import {
  Amount,
  OptionSelect,
  PERIODS,
  formatDay,
  formatMonth,
  memberNamer,
  periodRange,
  type Period,
} from "./finance-bits";
import { SplitCard } from "./split-card";

const TABS = [
  { key: "ledger", label: "Ledger" },
  { key: "balances", label: "Balances" },
  { key: "reports", label: "Reports" },
  { key: "split", label: "Split" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function FinancesPage() {
  const me = useMe(true);
  const boardId = me.data?.board?.id;
  if (!boardId) return <Skeleton className="m-6 h-96" />;
  return <Finances boardId={boardId} />;
}

function Finances({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const [filters, setFilters] = useState(DEFAULT_FINANCE_FILTERS);
  const [period, setPeriod] = useState<Period>("month");
  const [tab, setTab] = useState<Tab>("ledger");
  const [showVoid, setShowVoid] = useState(false);
  const [logging, setLogging] = useState<FinanceKind | null>(null);
  const [editing, setEditing] = useState<FinanceEntryDto | null>(null);

  const range = periodRange(period);
  const summary = useFinanceSummary(boardId, range);
  const entries = useFinanceEntries(boardId, {
    ...range,
    ...(showVoid ? { includeVoid: true } : {}),
  });

  if (!can("finance.view")) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Only admins can see this band&apos;s finances.
      </p>
    );
  }

  const data = summary.data;
  const currency = data?.currency ?? "USD";
  const members = data?.members ?? [];
  const rows = entries.data ?? [];
  const filteredRows = filterFinanceEntries(rows, filters);
  const hasFilters = Object.entries(filters).some(
    ([key, value]) =>
      value !== DEFAULT_FINANCE_FILTERS[key as keyof typeof filters],
  );

  const exportCsv = () => {
    const name = memberNamer(members);
    const csv = financeCsv(filteredRows, (id) => name(id));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `band-finances-${range.from ?? "all"}-${range.to ?? "time"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Finances</h1>
          <p className="text-sm text-muted-foreground">
            The band&apos;s books: what came in, what went out, and who&apos;s
            owed what.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-muted/60 p-1">
            {PERIODS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={period === p.key ? "default" : "ghost"}
                className="rounded-full"
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {can("finance.create") && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLogging("INCOME")}
              >
                <Plus data-icon="inline-start" />
                Income
              </Button>
              <Button size="sm" onClick={() => setLogging("EXPENSE")}>
                <Minus data-icon="inline-start" />
                Expense
              </Button>
            </>
          )}
        </div>
      </div>

      {!data ? (
        <Skeleton className="h-24" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="In"
            cents={data.totals.incomeCents}
            currency={currency}
          />
          <Stat
            label="Out"
            cents={-data.totals.expenseCents}
            currency={currency}
          />
          <Stat
            label="Net"
            cents={data.totals.netCents}
            currency={currency}
            strong
          />
          <Stat
            label="Still owed to the band"
            cents={data.totals.expectedCents}
            currency={currency}
            muted
          />
        </div>
      )}

      {data && data.pending.length > 0 && (
        <PendingApprovals
          boardId={boardId}
          data={data}
          canApprove={can("finance.manage")}
          onOpen={setEditing}
        />
      )}

      {data && data.sentBack.length > 0 && (
        <SentBack
          data={data}
          manages={can("finance.manage")}
          onOpen={setEditing}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex gap-1 rounded-full bg-muted/60 p-1">
          {TABS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={tab === t.key ? "default" : "ghost"}
              className="rounded-full"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </nav>
        {tab === "ledger" && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Show voided
              <Switch
                checked={showVoid}
                onCheckedChange={(checked) => {
                  setShowVoid(checked);
                  if (!checked && filters.state === "VOID")
                    setFilters({ ...filters, state: "all" });
                }}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={filteredRows.length === 0}
              onClick={exportCsv}
            >
              <Download data-icon="inline-start" />
              Export CSV
            </Button>
          </div>
        )}
      </div>

      {tab === "ledger" && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field>
              <FieldLabel htmlFor="finance-kind">Type</FieldLabel>
              <OptionSelect
                id="finance-kind"
                value={filters.kind}
                onChange={(kind) => setFilters({ ...filters, kind })}
                options={[
                  { value: "all", label: "All types" },
                  { value: "INCOME", label: "Income" },
                  { value: "EXPENSE", label: "Expenses" },
                ]}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="finance-member">Handled by</FieldLabel>
              <OptionSelect
                id="finance-member"
                value={filters.member}
                onChange={(member) => setFilters({ ...filters, member })}
                options={[
                  { value: "all", label: "All members" },
                  { value: "band", label: "Band account" },
                  ...members.map((m) => ({
                    value: m.id,
                    label: m.displayName,
                  })),
                ]}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="finance-category">Category</FieldLabel>
              <OptionSelect
                id="finance-category"
                value={filters.category}
                onChange={(category) => setFilters({ ...filters, category })}
                options={[
                  { value: "all", label: "All categories" },
                  ...FINANCE_CATEGORIES.map((c) => ({
                    value: c.key,
                    label: c.label,
                  })),
                ]}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="finance-state">Status</FieldLabel>
              <OptionSelect
                id="finance-state"
                value={filters.state}
                onChange={(state) => {
                  setFilters({ ...filters, state });
                  if (state === "VOID") setShowVoid(true);
                }}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "SETTLED", label: "Settled" },
                  { value: "EXPECTED", label: "Expected" },
                  { value: "PENDING", label: "Waiting for approval" },
                  { value: "REJECTED", label: "Sent back" },
                  ...(showVoid ? [{ value: "VOID", label: "Voided" }] : []),
                ]}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="finance-sort">Sort</FieldLabel>
              <OptionSelect
                id="finance-sort"
                value={filters.sort}
                onChange={(sort) =>
                  setFilters({ ...filters, sort: sort as FinanceSort })
                }
                options={FINANCE_SORTS.map((s) => ({ ...s }))}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {filteredRows.length} entries
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(DEFAULT_FINANCE_FILTERS);
                setPeriod("month");
                setShowVoid(false);
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>
      )}
      {tab === "ledger" &&
        (entries.error ? (
          <div role="alert" className="flex items-center gap-3">
            <p>Could not load finance entries.</p>
            <Button variant="outline" onClick={() => void entries.refetch()}>
              Try again
            </Button>
          </div>
        ) : entries.isPending ? (
          <Skeleton className="h-64" />
        ) : filteredRows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Wallet />
              </EmptyMedia>
              <EmptyTitle>
                {hasFilters
                  ? "No entries match these filters"
                  : "Nothing in the books for this period"}
              </EmptyTitle>
              <EmptyDescription>
                {hasFilters
                  ? "Change or reset the filters to see more entries."
                  : "Log a show fee, a merch night or a receipt to get started."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Ledger
            rows={filteredRows}
            currency={currency}
            name={memberNamer(members)}
            onOpen={setEditing}
          />
        ))}

      {tab === "balances" &&
        (data ? (
          <BalancesSection boardId={boardId} summary={data} />
        ) : (
          <Skeleton className="h-64" />
        ))}

      {tab === "reports" && <Reports rows={rows} currency={currency} />}

      {tab === "split" && (
        <div className="max-w-xl">
          <SplitCard boardId={boardId} members={members} />
        </div>
      )}

      <EntryDialog
        boardId={boardId}
        open={logging !== null}
        onOpenChange={(open) => !open && setLogging(null)}
        kind={logging ?? "EXPENSE"}
        members={members}
        currency={currency}
      />
      <EntryDialog
        boardId={boardId}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        entry={editing ?? undefined}
        members={members}
        currency={currency}
      />
    </div>
  );
}

function Stat({
  label,
  cents,
  currency,
  strong,
  muted,
}: {
  label: string;
  cents: number;
  currency: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-2xl", strong && "font-bold")}>
          <Amount
            cents={cents}
            currency={currency}
            className={cn(muted && "text-foreground dark:text-foreground")}
          />
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

/**
 * Members' out-of-pocket expenses that don't count yet. Everyone sees the
 * list; admins can approve from it, or open an entry to check it or reject it.
 */
function PendingApprovals({
  boardId,
  data,
  canApprove,
  onOpen,
}: {
  boardId: string;
  data: FinanceSummaryDto;
  canApprove: boolean;
  onOpen: (entry: FinanceEntryDto) => void;
}) {
  const approve = useApproveFinanceEntry(boardId);
  const reject = useRejectFinanceEntry(boardId);
  const name = memberNamer(data.members);
  // The entry being sent back, while its note is written.
  const [sendingBack, setSendingBack] = useState<FinanceEntryDto | null>(null);
  const [note, setNote] = useState("");
  const close = () => {
    setSendingBack(null);
    setNote("");
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          Waiting for approval
          <span className="ml-2 text-muted-foreground">
            {data.pending.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y text-sm">
          {data.pending.map((entry) => {
            // What an admin needs to decide without opening it.
            const waited = Date.now() - new Date(entry.createdAt).getTime();
            const stale = waited >= 7 * 24 * 60 * 60 * 1000;
            const details = [
              `${name(entry.handledById)} paid · ${formatDay(entry.occurredOn)}`,
              entry.eventTitle,
              entry.note,
            ].filter(Boolean);
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
              >
                <Paperclip
                  className={cn(
                    "size-4 shrink-0",
                    entry.receiptCount > 0
                      ? "text-foreground"
                      : "text-muted-foreground/40",
                  )}
                  aria-label={
                    entry.receiptCount > 0 ? "Has a receipt" : "No receipt"
                  }
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left hover:underline"
                  onClick={() => onOpen(entry)}
                >
                  <span className="block truncate font-medium">
                    {entry.description || categoryLabel(entry.category)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {details.join(" · ")}
                  </span>
                </button>
                <div className="flex flex-col items-end">
                  <Amount cents={-entry.amountCents} currency={data.currency} />
                  <span
                    className={cn(
                      "text-[11px]",
                      stale ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {stale
                      ? `waiting ${relativeTime(entry.createdAt)}`
                      : relativeTime(entry.createdAt)}
                  </span>
                </div>
                {canApprove && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(entry.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={reject.isPending}
                      onClick={() => setSendingBack(entry)}
                    >
                      Send back
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>

      <Dialog
        open={sendingBack !== null}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send it back</DialogTitle>
            <DialogDescription>
              {sendingBack &&
                `${name(sendingBack.handledById)} paid ${formatMoney(sendingBack.amountCents, data.currency)} for ${
                  sendingBack.description || categoryLabel(sendingBack.category)
                }. It stops counting until they fix it and save again — then it comes back to you.`}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reject-note">Note to them</FieldLabel>
            <Textarea
              id="reject-note"
              autoFocus
              rows={3}
              maxLength={500}
              placeholder="What should they fix? “Add the receipt”, “Was this the band’s?”…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={reject.isPending || sendingBack === null}
              onClick={() =>
                sendingBack &&
                reject.mutate(
                  { entryId: sendingBack.id, note: note.trim() },
                  { onSuccess: close },
                )
              }
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Expenses an admin sent back: the member's to fix (the server only returns
 * their own), or, for an admin, everything still out with a member.
 */
function SentBack({
  data,
  manages,
  onOpen,
}: {
  data: FinanceSummaryDto;
  manages: boolean;
  onOpen: (entry: FinanceEntryDto) => void;
}) {
  const name = memberNamer(data.members);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Sent back</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm">
          {data.sentBack.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3">
              <button
                type="button"
                className="min-w-0 flex-1 text-left hover:underline"
                onClick={() => onOpen(entry)}
              >
                <span className="block truncate">
                  {entry.description || categoryLabel(entry.category)}
                  {manages && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {name(entry.handledById)} paid ·{" "}
                      {formatDay(entry.occurredOn)}
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {entry.decisionNote
                    ? `“${entry.decisionNote}”`
                    : manages
                      ? "Waiting on them"
                      : "Fix it and save to ask again"}
                </span>
              </button>
              <Amount cents={-entry.amountCents} currency={data.currency} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Ledger({
  rows,
  currency,
  name,
  onOpen,
}: {
  rows: FinanceEntryDto[];
  currency: string;
  name: (userId: string | null) => string;
  onOpen: (entry: FinanceEntryDto) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">Date</TableHead>
          <TableHead>What</TableHead>
          <TableHead className="hidden md:table-cell">Category</TableHead>
          <TableHead className="hidden lg:table-cell">Show</TableHead>
          <TableHead className="hidden md:table-cell">Through</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((e) => (
          <TableRow
            key={e.id}
            className={cn("cursor-pointer", e.state === "VOID" && "opacity-50")}
            onClick={() => onOpen(e)}
          >
            <TableCell className="text-muted-foreground">
              {formatDay(e.occurredOn)}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className={cn(e.state === "VOID" && "line-through")}>
                  {e.description || categoryLabel(e.category)}
                </span>
                {e.receiptCount > 0 && (
                  <Paperclip
                    className="size-3.5 text-muted-foreground"
                    aria-label={`${e.receiptCount} receipt${e.receiptCount === 1 ? "" : "s"}`}
                  />
                )}
                {e.state === "EXPECTED" && (
                  <Badge variant="secondary">Owed</Badge>
                )}
                {e.state === "PENDING" && (
                  <Badge variant="secondary">Needs approval</Badge>
                )}
                {e.state === "REJECTED" && (
                  <Badge variant="destructive">Sent back</Badge>
                )}
                {e.state === "VOID" && <Badge variant="outline">Void</Badge>}
              </div>
              {e.counterparty && (
                <div className="text-xs text-muted-foreground">
                  {e.counterparty}
                </div>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {categoryLabel(e.category)}
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              {e.eventTitle ?? ""}
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">
              {e.handledById ? name(e.handledById) : "Band account"}
            </TableCell>
            <TableCell className="text-right">
              <Amount
                cents={e.kind === "INCOME" ? e.amountCents : -e.amountCents}
                currency={currency}
                signed
                className={cn(
                  e.state !== "SETTLED" &&
                    "text-muted-foreground dark:text-muted-foreground",
                )}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Profit and loss for the period, plus what each show made. */
function Reports({
  rows,
  currency,
}: {
  rows: FinanceEntryDto[];
  currency: string;
}) {
  const totals = useMemo(() => ledgerTotals(rows), [rows]);
  const shows = useMemo(() => {
    const byShow = new Map<
      string,
      { title: string; entries: FinanceEntryDto[] }
    >();
    for (const e of rows) {
      if (!e.eventId) continue;
      const show = byShow.get(e.eventId) ?? {
        title: e.eventTitle ?? "Show",
        entries: [],
      };
      show.entries.push(e);
      byShow.set(e.eventId, show);
    }
    return [...byShow.entries()].map(([id, s]) => ({
      id,
      title: s.title,
      ...ledgerTotals(s.entries),
    }));
  }, [rows]);
  const biggest = Math.max(1, ...totals.byCategory.map((c) => c.cents));

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing to report for this period yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>By month</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totals.byMonth.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{formatMonth(m.month)}</TableCell>
                  <TableCell className="text-right">
                    <Amount cents={m.incomeCents} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Amount cents={-m.expenseCents} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Amount
                      cents={m.incomeCents - m.expenseCents}
                      currency={currency}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {totals.byCategory.map((c) => (
              <li key={c.category} className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>{categoryLabel(c.category)}</span>
                  <Amount
                    cents={c.kind === "INCOME" ? c.cents : -c.cents}
                    currency={currency}
                  />
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      c.kind === "INCOME" ? "bg-emerald-500" : "bg-red-400",
                    )}
                    style={{ width: `${(c.cents / biggest) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {shows.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4" />
              Show by show
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Show</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Costs</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Owed
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.title}</TableCell>
                    <TableCell className="text-right">
                      <Amount cents={s.incomeCents} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Amount cents={-s.expenseCents} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Amount cents={s.netCents} currency={currency} />
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {s.expectedCents ? (
                        <Amount cents={s.expectedCents} currency={currency} />
                      ) : (
                        ""
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
