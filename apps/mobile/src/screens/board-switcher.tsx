import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  return (
    // The sheet's header is drawn over its content, so the content steps
    // below it with padding. This was a ScrollView inset natively for the
    // header, and the native inset is invisible to React Native's own layout:
    // each row's press area sat a header's height above the row
    // (react-native#43546). A row lit up on touch, but a release the press area
    // thought was outside it was dropped, so most taps never switched band.
    <View
      style={{
        backgroundColor: colors.background,
        padding: spacing.md,
        paddingTop: headerHeight + spacing.sm,
        paddingBottom: spacing.md + insets.bottom,
        gap: spacing.xs,
      }}
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
    </View>
  );
}
