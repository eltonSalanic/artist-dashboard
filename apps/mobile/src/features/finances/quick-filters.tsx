import { Pressable, ScrollView, View } from 'react-native';
import {
  activeFinanceFilterCount,
  BAND_ACCOUNT,
  categoryLabel,
  type FinanceMemberRef,
  type FinanceViewFilters,
} from '@artist/shared';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { posterRadius, radius, spacing, useTokens } from '@/theme';
import {
  clearFilters,
  toggleCategory,
  toggleKind,
  toggleMember,
  togglePayback,
} from './quick-filter-logic';

/**
 * The row of one-tap filters over a timeline, scrolling sideways: All,
 * Expenses, Income, Owed back, Paid back, then each payer (or, on a member's
 * own page, the categories they spend on). Each chip is a shortcut to a
 * setting in the full filter sheet, which the first chip opens; the two edit
 * the same filters, so they never disagree.
 */
export function QuickFilters({
  filters,
  onChange,
  onOpenSheet,
  members,
  categories,
  kinds = true,
  me,
}: {
  filters: FinanceViewFilters;
  onChange: (next: FinanceViewFilters) => void;
  onOpenSheet: () => void;
  /** Payer chips: the band account, then each member. */
  members?: FinanceMemberRef[];
  /** Category chips, by key. */
  categories?: string[];
  /** Off on a list that is all expenses. */
  kinds?: boolean;
  /** The viewer, whose payer chip says "You". */
  me?: string;
}) {
  const tokens = useTokens();
  const active = activeFinanceFilterCount(filters) + (filters.sort === 'newest' ? 0 : 1);
  const chips: { key: string; label: string; selected: boolean; onPress: () => void }[] = [
    {
      key: 'all',
      label: 'All',
      selected: activeFinanceFilterCount(filters) === 0,
      onPress: () => onChange(clearFilters(filters)),
    },
    ...(kinds
      ? [
          {
            key: 'expense',
            label: 'Expenses',
            selected: filters.kind === 'EXPENSE',
            onPress: () => onChange(toggleKind(filters, 'EXPENSE')),
          },
          {
            key: 'income',
            label: 'Income',
            selected: filters.kind === 'INCOME',
            onPress: () => onChange(toggleKind(filters, 'INCOME')),
          },
        ]
      : []),
    {
      key: 'owed',
      label: 'Owed back',
      selected: filters.payback === 'owed',
      onPress: () => onChange(togglePayback(filters, 'owed')),
    },
    {
      key: 'paid',
      label: 'Paid back',
      selected: filters.payback === 'paid',
      onPress: () => onChange(togglePayback(filters, 'paid')),
    },
    ...(members
      ? [
          {
            key: BAND_ACCOUNT,
            label: 'Band account',
            selected: filters.members.includes(BAND_ACCOUNT),
            onPress: () => onChange(toggleMember(filters, BAND_ACCOUNT)),
          },
          ...members.map((m) => ({
            key: m.id,
            label: m.id === me ? 'You' : m.displayName.split(' ')[0],
            selected: filters.members.includes(m.id),
            onPress: () => onChange(toggleMember(filters, m.id)),
          })),
        ]
      : []),
    ...(categories ?? []).map((key) => ({
      key,
      label: categoryLabel(key),
      selected: filters.category === key,
      onPress: () => onChange(toggleCategory(filters, key)),
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Edge to edge, so the row scrolls out under the screen's own margin.
      style={{ flexGrow: 0, marginHorizontal: -spacing.md }}
      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={active ? `Filters, ${active} on` : 'Filters'}
        onPress={onOpenSheet}
        hitSlop={4}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs + 2,
          minHeight: 36,
          paddingHorizontal: spacing.md - 4,
          borderRadius: posterRadius.chip,
          borderWidth: 1.5,
          borderColor: tokens.foreground,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon
          name={{ sf: 'slider.horizontal.3', md: 'tune' }}
          size={15}
          color={tokens.foreground}
        />
        <PosterText variant="chip" color={tokens.foreground}>
          Filters
        </PosterText>
        {active > 0 && (
          <View
            style={{
              minWidth: 18,
              height: 18,
              paddingHorizontal: 5,
              borderRadius: radius.full,
              backgroundColor: tokens.foreground,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PosterText
              variant="meta"
              color={tokens.background}
              style={{ fontSize: 11, lineHeight: 14 }}
            >
              {String(active)}
            </PosterText>
          </View>
        )}
      </Pressable>
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: chip.selected }}
          onPress={chip.onPress}
          hitSlop={4}
          style={({ pressed }) => ({
            minHeight: 36,
            justifyContent: 'center',
            paddingHorizontal: spacing.md - 2,
            borderRadius: posterRadius.chip,
            borderCurve: 'continuous',
            backgroundColor: chip.selected ? tokens.foreground : tokens.muted,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <PosterText
            variant="chip"
            numberOfLines={1}
            color={chip.selected ? tokens.background : tokens.foreground}
          >
            {chip.label}
          </PosterText>
        </Pressable>
      ))}
    </ScrollView>
  );
}
