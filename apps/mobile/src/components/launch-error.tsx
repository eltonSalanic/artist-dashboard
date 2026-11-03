import { View } from 'react-native';
import { NetworkError, toUserMessage } from '@artist/api-client';
import { spacing, usePosterCanvas } from '@/theme';
import { Button } from './button';
import { MASCOT_WIDTH, MyMascot, PhraseLettering } from './mascot';
import { PosterText } from './poster-text';

const centred = { textAlign: 'center' } as const;

/**
 * The screen when the very first request after launch fails, so the app has
 * nothing to show yet. Set in the same poster voice as sign-in (small caps
 * over a big black headline), so it reads as part of Band Wall rather than a
 * system error, and always offers a way forward: try again, or sign out.
 */
export function LaunchError({
  error,
  retrying,
  onRetry,
  onSignOut,
}: {
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const canvas = usePosterCanvas();
  const offline = error instanceof NetworkError;

  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        justifyContent: 'center',
        gap: spacing.xl,
        paddingHorizontal: spacing.lg,
        backgroundColor: canvas.background,
      }}
    >
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        {/* Offline isn't broken, so the mascot only says so when it is. */}
        {!offline && <PhraseLettering phrase="somethingBroke" label="Something broke" />}
        <MyMascot pose="emptyBare" width={MASCOT_WIDTH} />
        <View style={{ gap: spacing.xs }}>
          <PosterText variant="label" color={canvas.soft} style={centred}>
            BAND WALL
          </PosterText>
          <PosterText variant="display" color={canvas.ink} style={centred}>
            {offline ? "You're offline" : "Couldn't load your bands"}
          </PosterText>
        </View>
        <PosterText variant="paragraph" color={canvas.soft} style={centred}>
          {offline
            ? "Band Wall can't reach the server. Check your Wi-Fi or mobile data, then try again."
            : toUserMessage(error)}
        </PosterText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button title="Try again" loading={retrying} onPress={onRetry} />
        <Button title="Sign out" variant="ghost" onPress={onSignOut} />
      </View>
    </View>
  );
}
