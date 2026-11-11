import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { authErrorMessage } from '@artist/api-client';
import { Button, BUTTON_HEIGHT } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/theme';
import {
  appleAvailable,
  googleAvailable,
  signInWithApple,
  signInWithGoogle,
  type SocialOutcome,
} from './social-sign-in';

interface Props {
  /** Off while the email form, or the other button, is busy. */
  disabled: boolean;
  /** Called as a sign-in starts, so the screen can lock its form. */
  onStart(): void;
  /**
   * Called when it ends: with a message to show, or `null` when it worked or
   * the person closed the sheet (`cancelled`). On success the root layout
   * swaps the stack.
   */
  onEnd(error: string | null, cancelled: boolean): void;
}

/**
 * "or", then Sign in with Apple (iPhone only, first, in Apple's own button as
 * the App Store asks) and Continue with Google. Either signs in, or makes the
 * account the first time; hidden entirely when neither is set up.
 */
export function SocialButtons({ disabled, onStart, onEnd }: Props) {
  const scheme = useColorScheme();
  const [apple, setApple] = useState(false);
  const google = googleAvailable();

  useEffect(() => {
    let live = true;
    void appleAvailable().then((ok) => live && setApple(ok));
    return () => {
      live = false;
    };
  }, []);

  if (!apple && !google) return null;

  const run = async (start: () => Promise<SocialOutcome>, fallback: string) => {
    onStart();
    try {
      const result = await start();
      onEnd(result?.error ? authErrorMessage(result.error, fallback) : null, result === null);
    } catch (thrown) {
      onEnd(authErrorMessage({ message: String(thrown), status: 0 }, fallback), false);
    }
  };

  return (
    <View style={styles.root}>
      <ThemedText variant="footnote" tone="muted" style={styles.or}>
        or
      </ThemedText>
      {apple && (
        <View pointerEvents={disabled ? 'none' : 'auto'} style={disabled && styles.dim}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            // Black on the light poster, white on the dark one.
            buttonStyle={
              scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            // A capsule, like the app's own buttons.
            cornerRadius={BUTTON_HEIGHT / 2}
            style={styles.apple}
            onPress={() => void run(signInWithApple, "Couldn't sign in with Apple. Try again.")}
          />
        </View>
      )}
      {google && (
        <Button
          title="Continue with Google"
          variant="secondary"
          icon={<Image source={googleLogo} style={styles.googleLogo} accessible={false} />}
          disabled={disabled}
          onPress={() => void run(signInWithGoogle, "Couldn't sign in with Google. Try again.")}
        />
      )}
    </View>
  );
}

// Google's multicolour "G", which its branding rules ask for on the button.
const googleLogo = require('../../../assets/images/google-g.svg');

const styles = StyleSheet.create({
  googleLogo: { width: 18, height: 18 },
  root: { gap: spacing.sm },
  or: { textAlign: 'center' },
  apple: { height: BUTTON_HEIGHT, width: '100%' },
  dim: { opacity: 0.5 },
});
