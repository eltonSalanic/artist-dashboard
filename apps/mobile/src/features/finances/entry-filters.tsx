import { useState } from 'react';
import { View } from 'react-native';
import {
  BAND_ACCOUNT,
  DEFAULT_FINANCE_FILTERS,
  FINANCE_CATEGORIES,
  FINANCE_SORTS,
  parseMoneyToCents,
  type FinanceMemberRef,
  type FinanceSort,
  type FinanceViewFilters,
} from '@artist/shared';
import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { PickOne } from '@/components/pick-one';
import { TextField } from '@/components/text-field';
import { spacing } from '@/theme';

/** Cents as the text an amount box shows: `1250` → "12.50". */
const toText = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2));

/**
 * Narrowing a ledger list: type, who paid, category, owed or paid back, an
 * amount range and the sort. Search lives above the list, not in here, so it's
 * always one tap away.
 *
 * `members` off hides "Who paid" (a member's own list is all theirs), and
 * `kinds` off hides the type (a member's list is all expenses).
 */
export function FinanceFilters({
  filters,
  onChange,
  members,
  kinds = true,
}: {
  filters: FinanceViewFilters;
  onChange: (next: FinanceViewFilters) => void;
  members?: FinanceMemberRef[];
  kinds?: boolean;
}) {
  // Typed amounts stay as typed; the filter only takes them once they parse.
  const [min, setMin] = useState(toText(filters.minCents));
  const [max, setMax] = useState(toText(filters.maxCents));
  const set = (patch: Partial<FinanceViewFilters>) => onChange({ ...filters, ...patch });
  const amount = (text: string) => (text.trim() === '' ? null : parseMoneyToCents(text));
  const categories = FINANCE_CATEGORIES.filter(
    (c) => filters.kind === 'all' || c.kind === filters.kind,
  );

  return (
    <View style={{ gap: spacing.lg, paddingVertical: spacing.sm }}>
      {kinds && (
        <ChoiceChips<string>
          label="Type"
          value={filters.kind}
          onChange={(kind) =>
            set({
              kind,
              // A category from the other side would match nothing.
              category: FINANCE_CATEGORIES.some(
                (c) => c.key === filters.category && (kind === 'all' || c.kind === kind),
              )
                ? filters.category
                : 'all',
            })
          }
          choices={[
            { value: 'all', label: 'Everything' },
            { value: 'EXPENSE', label: 'Expenses' },
            { value: 'INCOME', label: 'Income' },
          ]}
        />
      )}
      {members && (
        <ChoiceChips<string>
          multiple
          label="Who paid"
          hint="Pick one or more. None picked shows everyone."
          value={filters.members}
          onChange={(picked) => set({ members: picked })}
          choices={[
            { value: BAND_ACCOUNT, label: 'Band account' },
            ...members.map((m) => ({ value: m.id, label: m.displayName })),
          ]}
        />
      )}
      <PickOne
        label="Category"
        noneLabel="All categories"
        value={filters.category === 'all' ? null : filters.category}
        options={categories.map((c) => ({ value: c.key, label: c.label }))}
        onChange={(value) => set({ category: value ?? 'all' })}
      />
      {filters.kind !== 'INCOME' && (
        <ChoiceChips<FinanceViewFilters['payback']>
          label="Paid back"
          hint="Only expenses a member paid out of pocket."
          value={filters.payback}
          onChange={(payback) => set({ payback })}
          choices={[
            { value: 'all', label: 'Any' },
            { value: 'owed', label: 'Owed back' },
            { value: 'paid', label: 'Paid back' },
          ]}
        />
      )}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Min amount"
            value={min}
            onChangeText={(text) => {
              setMin(text);
              const cents = amount(text);
              if (cents !== null || text.trim() === '') set({ minCents: cents });
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            error={min.trim() !== '' && amount(min) === null ? 'Like 12.50' : null}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Max amount"
            value={max}
            onChangeText={(text) => {
              setMax(text);
              const cents = amount(text);
              if (cents !== null || text.trim() === '') set({ maxCents: cents });
            }}
            keyboardType="decimal-pad"
            placeholder="Any"
            error={max.trim() !== '' && amount(max) === null ? 'Like 12.50' : null}
          />
        </View>
      </View>
      <PickOne
        label="Sort"
        noneLabel="Newest first"
        value={filters.sort === 'newest' ? null : filters.sort}
        options={FINANCE_SORTS.filter((s) => s.value !== 'newest').map((s) => ({
          ...s,
        }))}
        onChange={(value) => set({ sort: (value ?? 'newest') as FinanceSort })}
      />
      <Button
        title="Reset filters"
        variant="ghost"
        size="sm"
        onPress={() => {
          setMin('');
          setMax('');
          onChange({ ...DEFAULT_FINANCE_FILTERS, query: filters.query });
        }}
      />
    </View>
  );
}
