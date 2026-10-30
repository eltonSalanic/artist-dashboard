import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardSubscription } from '@artist/api-client';
import { PosterText } from '@/components/poster-text';
import { useSelectedBoard } from '@/features/board/selected-board';
import { InkButton } from '@/features/onboarding/ink-button';
import { posterSlot, spacing, useScheme } from '@/theme';

/**
 * Shown once, after joining with an invite code: the band you're in, in its
 * own colour, and that it costs you nothing. Members never see a paywall.
 */
export function WelcomeInScreen() {
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const { board } = useSelectedBoard();
  const owner = useBoardSubscription(board?.id).data?.ownerName;
  const block = posterSlot(board?.palette ?? 'playful', scheme, 'c1');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: block.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View accessible accessibilityRole="header" style={{ gap: spacing.sm }}>
        <PosterText variant="label" color={block.soft}>
          WELCOME IN
        </PosterText>
        <PosterText variant="display" color={block.ink}>
          {`You're In\n${board?.name ?? 'The Band'}.`}
        </PosterText>
        <PosterText variant="body" color={block.ink}>
          {owner
            ? `It's free for you: ${owner}'s subscription covers the whole band.`
            : "It's free for you: the band's owner covers everyone in it."}
        </PosterText>
      </View>
      <View style={{ flex: 1 }} />
      <InkButton
        title="See the wall"
        ink={block.ink}
        bg={block.bg}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
});
