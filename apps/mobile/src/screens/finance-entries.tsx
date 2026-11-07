import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  useFinanceEntries,
  useFinanceSummary,
  usePermissions,
} from "@artist/api-client";
import {
  activeFinanceFilterCount,
  DEFAULT_FINANCE_FILTERS,
  filterFinanceEntries,
  formatMoney,
} from "@artist/shared";
import { Button } from "@/components/button";
import { PosterText } from "@/components/poster-text";
import { SpokeList } from "@/components/spoke-list";
import { FinanceEntryRow } from "@/features/finances/entry-row";
import { FinanceFilters } from "@/features/finances/entry-filters";
import { FinanceSearch } from "@/features/finances/finance-search";
import { shareFinanceCsv } from "@/features/finances/export-csv";
import { spacing, useTokens } from "@/theme";

/**
 * Every income and expense entry the band has logged, all time: search by
 * name, and filter by type, who paid, category, paid back and amount. Tapping
 * an entry opens its form.
 */
export function FinanceEntriesScreen({ boardId }: { boardId: string }) {
  const tokens = useTokens();
  const { can } = usePermissions();
  const visible = can("finance.view");
  const summary = useFinanceSummary(boardId, {}, visible);
  const entries = useFinanceEntries(boardId);
  const [filters, setFilters] = useState(DEFAULT_FINANCE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const currency = summary.data?.currency ?? "USD";
  const members = summary.data?.members ?? [];
  const name = (userId: string) =>
    members.find((m) => m.id === userId)?.displayName ?? "Former member";
  const all = entries.data ?? [];
  const rows = filterFinanceEntries(all, filters);
  const active = activeFinanceFilterCount(filters);
  const narrowed = active > 0 || filters.query.trim() !== "";
  const net = rows.reduce(
    (sum, e) =>
      sum +
      (e.state === "SETTLED"
        ? e.kind === "INCOME"
          ? e.amountCents
          : -e.amountCents
        : 0),
    0,
  );

  return (
    <SpokeList
      pending={visible && (summary.isPending || entries.isPending)}
      error={summary.error ?? entries.error}
      onRetry={() => {
        void summary.refetch();
        void entries.refetch();
      }}
      empty={!visible || rows.length === 0}
      emptyIcon={{ sf: "dollarsign.circle", md: "account-balance-wallet" }}
      emptyTitle={
        !visible
          ? "Only admins see the books"
          : narrowed
            ? "No matches"
            : "Nothing logged yet"
      }
      emptyBody={
        visible && narrowed
          ? "Nothing matches this search and these filters."
          : visible
            ? "Log income or an expense with the + on Finances."
            : undefined
      }
      header={
        visible && all.length > 0 ? (
          <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            <FinanceSearch
              value={filters.query}
              onChange={(query) => setFilters({ ...filters, query })}
            />
            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
              }}
            >
              <Button
                title={`${filtersOpen ? "Hide filters" : "Filter and sort"}${active ? ` (${active})` : ""}`}
                variant="secondary"
                size="sm"
                onPress={() => setFiltersOpen(!filtersOpen)}
              />
              {rows.length > 0 && (
                <Button
                  title="Export CSV"
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    void shareFinanceCsv(
                      rows,
                      members,
                      narrowed ? "filtered" : "all-time",
                    )
                  }
                />
              )}
            </View>
            {filtersOpen && (
              <FinanceFilters
                filters={filters}
                onChange={setFilters}
                members={members}
              />
            )}
            <PosterText variant="cardMeta" color={tokens.mutedForeground}>
              {`${rows.length} of ${all.length} ${all.length === 1 ? "entry" : "entries"}${
                narrowed ? ` · net ${formatMoney(net, currency)}` : ""
              }`}
            </PosterText>
          </View>
        ) : undefined
      }
    >
      {rows.map((entry, index) => (
        <FinanceEntryRow
          key={entry.id}
          entry={entry}
          currency={currency}
          first={index === 0}
          name={name}
          onPress={() =>
            router.push(`/board/${boardId}/form/finance?id=${entry.id}`)
          }
        />
      ))}
    </SpokeList>
  );
}
