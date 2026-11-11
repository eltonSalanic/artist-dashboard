import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoardSubscription } from '@artist/api-client';
import { roleIntro } from '@artist/shared';
import { MASCOT_WIDTH, MyMascot, PhraseLettering } from '@/components/mascot';
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
  // What they can do here, said once while they're paying attention. The
  // hub's card says it again with the links.
  const intro = board ? roleIntro(board.role, false) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: block.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View style={styles.middle}>
        {/* The mascot cheers it in its own hand, so the headline is just the band. */}
        <View style={styles.mascot}>
          <PhraseLettering phrase="youreIn" label="You're in" on={block.bg} />
          <MyMascot pose="celebrateBare" width={MASCOT_WIDTH} on={block.bg} />
        </View>
        <View accessible accessibilityRole="header" style={{ gap: spacing.sm }}>
          <PosterText variant="display" color={block.ink} style={styles.centred}>
            {board?.name ?? 'The band'}
          </PosterText>
          <PosterText variant="body" color={block.ink} style={styles.centred}>
            {owner
              ? `${owner}'s subscription covers the whole band`
              : "Your band owner's subscription covers the whole band"}
          </PosterText>
          {intro && (
            <PosterText variant="paragraph" color={block.ink} style={[styles.centred, styles.role]}>
              {`${intro.title}. ${intro.body}`}
            </PosterText>
          )}
        </View>
      </View>
      <InkButton
        title="See The Wall"
        ink={block.ink}
        bg={block.bg}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
  // Fills the room above the button and sits the message just above its middle.
  middle: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.xxl },
  mascot: { alignSelf: 'center', alignItems: 'center', gap: spacing.md },
  centred: { textAlign: 'center' },
  role: { paddingTop: spacing.sm, opacity: 0.85 },
});
