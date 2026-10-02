import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useSelectedBoard } from '@/features/board/selected-board';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * The board switcher, reached by tapping the board name in the header — the
 * Slack/Notion/Linear convention, which needs no teaching. It is deliberately
 * not a tab: mixing a mode switch into a content tab strip breaks what the
 * strip teaches, and the rightmost item of a strip is both hardest to reach and
 * first to disappear.
 */
export function BoardSwitcherSheet() {
  const colors = useThemeColors();
  const { boards, board, select } = useSelectedBoard();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
    >
      {boards.map((candidate) => {
        const current = candidate.id === board?.id;
        return (
          <Pressable
            key={candidate.id}
            accessibilityRole="button"
            accessibilityState={{ selected: current }}
            onPress={() => {
              select(candidate.id);
              router.back();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: pressed ? colors.accent : colors.card,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="headline">{candidate.name}</ThemedText>
              <ThemedText variant="footnote" tone="muted">
                {candidate.role.toLowerCase()}
              </ThemedText>
            </View>
            {current && (
              <Icon
                name={{ sf: 'checkmark', md: 'check' }}
                size={18}
                color={colors.primary}
              />
            )}
          </Pressable>
        );
      })}

      {boards.length === 1 && (
        <ThemedText variant="footnote" tone="muted" style={{ padding: spacing.sm }}>
          You are only in one band. Ask an admin to invite you to another, or
          create one on the web.
        </ThemedText>
      )}
    </ScrollView>
  );
}
