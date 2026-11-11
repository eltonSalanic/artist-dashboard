import { ScrollView, View } from 'react-native';
import { HELP_TOPICS, HelpTopicIds, roleIntro } from '@artist/shared';
import { SectionCard } from '@/components/section-card';
import { ThemedText } from '@/components/themed-text';
import { useSelectedBoard } from '@/features/board/selected-board';
import { HelpTopicBody } from '@/features/help/help-topic';
import { spacing, useThemeColors, useTokens } from '@/theme';

/** Lines a card's content up with its title, which is inset the same. */
const inset = { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm } as const;

/**
 * "How Band Wall works", from the You tab: every help topic on one page, for
 * whoever closed the hub's card or wants the whole picture. The same words the
 * (i) sheets show, one card per topic. It opens on where the person stands in
 * the band they're looking at.
 */
export function HelpScreen() {
  const colors = useThemeColors();
  const tokens = useTokens();
  const { board } = useSelectedBoard();
  const intro = board ? roleIntro(board.role, board.isOwner) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md }}
    >
      {board && intro && (
        <SectionCard title={intro.title} caption={`In ${board.name}`}>
          <ThemedText variant="subhead" tone="muted" style={inset}>
            {intro.body}
          </ThemedText>
        </SectionCard>
      )}
      {HelpTopicIds.map((id) => (
        <SectionCard key={id} title={HELP_TOPICS[id].title} description={HELP_TOPICS[id].summary}>
          <View style={inset}>
            <HelpTopicBody
              topic={HELP_TOPICS[id]}
              ink={tokens.foreground}
              soft={tokens.mutedForeground}
            />
          </View>
        </SectionCard>
      ))}
    </ScrollView>
  );
}
