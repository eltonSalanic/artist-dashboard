import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { WallIntro, type IntroLook } from '@/features/onboarding/wall-intro/wall-intro';
import { ThemeTokensProvider, cardTokens, spacing, usePosterCanvas, useScheme } from '@/theme';

/**
 * The first screen for someone signed out: a band's wall building itself,
 * then two doors for the two kinds of new person. Creating a band leads to the
 * account, the band's name and colour, then the plan; an invite leads to the
 * code from the email. Signing in is a link, since it's the one path people
 * already know.
 */
export function WelcomeScreen() {
  return <WallIntro footer={(look) => <Actions look={look} />} />;
}

/**
 * The buttons sit on the page until the preview cuts to the band's colour,
 * then take that colour's tokens, the way a button on a coloured card does.
 */
function Actions({ look }: { look: IntroLook }) {
  const canvas = usePosterCanvas();
  const scheme = useScheme();
  const ink = look.poster ?? canvas;

  const actions = (
    <View style={styles.actions}>
      <Button title="Create A Band Wall" onPress={() => router.push('/sign-in?mode=signup')} />
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
        <PosterText variant="body" color={ink.soft}>
          Already in?{' '}
          <PosterText variant="body" color={ink.ink}>
            Sign in
          </PosterText>
        </PosterText>
      </Pressable>
    </View>
  );

  return look.poster ? (
    <ThemeTokensProvider value={cardTokens(look.palette, scheme, 'c1')}>{actions}</ThemeTokensProvider>
  ) : (
    actions
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  link: { alignItems: 'center', paddingVertical: spacing.sm },
});
