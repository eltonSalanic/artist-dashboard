import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { posterRadius, posterSlot, spacing, usePosterCanvas, useScheme } from '@/theme';

/**
 * The first screen for someone signed out: what Band Wall is, and two doors
 * for the two kinds of new person. Starting a band leads to the account, the
 * band's name and colour, then the plan; an invite leads to the code from the
 * email. Signing in is a link, since it's the one path people already know.
 *
 * The coral block is an example of the wall, set the way the hub sets a show.
 */
export function WelcomeScreen() {
  const canvas = usePosterCanvas();
  const scheme = useScheme();
  const insets = useSafeAreaInsets();
  const show = posterSlot('playful', scheme, 'c1');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: canvas.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View accessible accessibilityRole="header" style={styles.masthead}>
        <PosterText variant="label" color={canvas.soft}>
          BAND WALL
        </PosterText>
        <PosterText variant="display" color={canvas.ink}>
          {"Your band's whole life, one wall."}
        </PosterText>
        <PosterText variant="body" color={canvas.soft}>
          Shows, rehearsals, tasks and money, shared with everyone in the band.
        </PosterText>
      </View>

      <View
        accessible
        accessibilityLabel="Example: next show Friday the 14th at The Echo, load-in 6pm"
        style={[styles.block, { backgroundColor: show.bg }]}
      >
        <PosterText variant="label" color={show.soft}>
          NEXT SHOW
        </PosterText>
        <PosterText variant="figure" color={show.ink}>
          Fri 14
        </PosterText>
        <PosterText variant="body" color={show.ink}>
          The Echo · load-in 6pm
        </PosterText>
      </View>

      <View style={{ flex: 1 }} />

      <View style={styles.actions}>
        <Button title="Start a band" onPress={() => router.push('/sign-in?mode=signup')} />
        <Button
          title="I've got an invite"
          variant="secondary"
          onPress={() => router.push('/sign-in?mode=invite')}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Already in? Sign in"
          onPress={() => router.push('/sign-in?mode=signin')}
          style={styles.link}
        >
          <PosterText variant="body" color={canvas.soft}>
            Already in?{' '}
            <PosterText variant="body" color={canvas.ink}>
              Sign in
            </PosterText>
          </PosterText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
  masthead: { gap: spacing.sm },
  block: {
    borderRadius: posterRadius.block * 1.7,
    borderCurve: 'continuous',
    padding: spacing.md + 2,
    gap: spacing.xs,
  },
  actions: { gap: spacing.sm },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
});
