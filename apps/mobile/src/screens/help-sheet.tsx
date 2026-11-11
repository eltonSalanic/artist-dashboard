import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HELP_TOPICS, HelpTopicIds, type HelpTopicId } from '@artist/shared';
import { PosterText } from '@/components/poster-text';
import { ThemedText } from '@/components/themed-text';
import { HelpTopicBody } from '@/features/help/help-topic';
import { spacing, usePosterCanvas } from '@/theme';
import { sheetBackground } from '@/lib/liquid-glass';

/**
 * One help topic, as a sheet over whatever asked for it: the (i) beside the
 * role chips, the band fund, the members list. Text only, so unlike the
 * status sheet it can scroll (that sheet's rows are why it can't).
 *
 * It draws its own title rather than using the sheet's bar. The bar is laid
 * over the content, so text scrolled up ran straight through its title (iOS 26
 * fades content under a bar only for a scroll view it tracks, and it didn't
 * here), and padding below it by `useHeaderHeight()`, as the other sheets do,
 * left a blank band: in a sheet with detents that height counts the status bar
 * too. Here the title sits above the scroll view, which clips what scrolls.
 */
export function HelpSheet({ topic }: { topic: string }) {
  const canvas = usePosterCanvas();
  const insets = useSafeAreaInsets();
  const id: HelpTopicId = (HelpTopicIds as readonly string[]).includes(topic)
    ? (topic as HelpTopicId)
    : 'roles';
  const help = HELP_TOPICS[id];

  const background = sheetBackground(canvas.background);

  return (
    // Two siblings, not one wrapping view: react-native-screens sizes a sheet's
    // scroll view to the whole sheet unless a header sits just before it, as
    // the screen's first child (`collapsable={false}` keeps that view real).
    <>
      <View
        collapsable={false}
        style={{
          backgroundColor: background,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          alignItems: 'center',
        }}
      >
        {/* Where the sheet's bar would put its title, under the grabber. */}
        <ThemedText variant="headline" accessibilityRole="header">
          How it works
        </ThemedText>
      </View>
      <ScrollView
        style={{ flex: 1, backgroundColor: background }}
        contentContainerStyle={{
          padding: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xl + insets.bottom,
          gap: spacing.md,
        }}
      >
        <View style={{ gap: 2, paddingBottom: spacing.xs }}>
          <PosterText variant="statement" color={canvas.ink} accessibilityRole="header">
            {help.title}
          </PosterText>
          <PosterText variant="body" color={canvas.soft}>
            {help.summary}
          </PosterText>
        </View>
        <HelpTopicBody topic={help} ink={canvas.ink} soft={canvas.soft} />
      </ScrollView>
    </>
  );
}
