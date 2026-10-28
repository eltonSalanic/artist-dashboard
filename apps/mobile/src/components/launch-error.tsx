import { View } from 'react-native';
import { NetworkError, toUserMessage } from '@artist/api-client';
import { radius, spacing, usePosterCanvas } from '@/theme';
import { Button } from './button';
import { Icon } from './icon';
import { PosterText } from './poster-text';

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
      <View style={{ gap: spacing.md }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.full,
            backgroundColor: canvas.faint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={
              offline
                ? { sf: 'wifi.slash', md: 'wifi-off' }
                : { sf: 'exclamationmark.triangle', md: 'warning' }
            }
            size={28}
            color={canvas.ink}
          />
        </View>
        <View style={{ gap: spacing.xs }}>
          <PosterText variant="label" color={canvas.soft}>
            BAND WALL
          </PosterText>
          <PosterText variant="display" color={canvas.ink}>
            {offline ? "You're offline" : "Couldn't load your bands"}
          </PosterText>
        </View>
        <PosterText variant="paragraph" color={canvas.soft}>
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
