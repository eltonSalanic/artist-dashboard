import { useState } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  activeFinanceFilterCount,
  type FinanceMemberRef,
  type FinanceViewFilters,
} from '@artist/shared';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { HeaderText } from '@/features/forms/form-screen';
import { radius, spacing, useShadows, useTokens } from '@/theme';
import { FinanceFilters } from './entry-filters';
import { FinanceSearch } from './finance-search';
import { clearFilters } from './quick-filter-logic';

const RISE = SlideInDown.duration(260).reduceMotion(ReduceMotion.System);

/**
 * Every filter at once, in a sheet that rises over the timeline: type, who
 * paid, category, paid back, amount and sort, and the search when the screen
 * doesn't already show one. The list behind updates as you pick, and the
 * button at the foot says how many entries are left before you close it.
 */
export function FilterSheet({
  visible,
  onClose,
  filters,
  onChange,
  resultCount,
  nouns = ['entry', 'entries'],
  members,
  kinds = true,
  search = false,
}: {
  visible: boolean;
  onClose: () => void;
  filters: FinanceViewFilters;
  onChange: (next: FinanceViewFilters) => void;
  /** How many entries match, for the button at the foot. */
  resultCount: number;
  /** What the list holds, one and many: ["entry", "entries"]. */
  nouns?: [string, string];
  /** Who-paid choices; left out on a member's own list. */
  members?: FinanceMemberRef[];
  kinds?: boolean;
  /** Search in the sheet, for a screen without a search box of its own. */
  search?: boolean;
}) {
  const tokens = useTokens();
  const shadows = useShadows();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Bumped by Reset so the amount boxes, which keep what was typed, start over.
  const [generation, setGeneration] = useState(0);
  const narrowed =
    activeFinanceFilterCount(filters) > 0 || filters.sort !== 'newest' || filters.query !== '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.32)',
          }}
        />
        <Animated.View
          entering={RISE}
          accessibilityViewIsModal
          style={{
            maxHeight: height * 0.86,
            backgroundColor: tokens.background,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderCurve: 'continuous',
            boxShadow: shadows.overlay,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 5,
              borderRadius: radius.full,
              backgroundColor: tokens.border,
              marginTop: spacing.sm,
            }}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              minHeight: 48,
            }}
          >
            <PosterText variant="title" color={tokens.foreground} accessibilityRole="header">
              Filter and sort
            </PosterText>
            <HeaderText
              title="Reset"
              disabled={!narrowed}
              onPress={() => {
                onChange({
                  ...clearFilters(filters),
                  sort: 'newest',
                  query: search ? '' : filters.query,
                });
                setGeneration((g) => g + 1);
              }}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
            style={{ flexShrink: 1 }}
          >
            {search && (
              <FinanceSearch
                value={filters.query}
                onChange={(query) => onChange({ ...filters, query })}
              />
            )}
            <FinanceFilters
              key={generation}
              filters={kinds ? filters : { ...filters, kind: 'EXPENSE' }}
              // A member's list is all expenses: the type stays as the screen set it.
              onChange={(next) => onChange(kinds ? next : { ...next, kind: filters.kind })}
              members={members}
              kinds={kinds}
            />
          </ScrollView>
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
            <Button
              title={
                resultCount === 0
                  ? 'Nothing matches'
                  : `Show ${resultCount} ${resultCount === 1 ? nouns[0] : nouns[1]}`
              }
              onPress={onClose}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
