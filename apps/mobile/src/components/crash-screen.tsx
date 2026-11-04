import { useEffect } from 'react';
import { View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { reportError } from '@/lib/report-error';
import { spacing, useThemeColors } from '@/theme';
import { Button } from './button';
import { MASCOT_WIDTH, MyMascot, PhraseLettering } from './mascot';
import { ThemedText } from './themed-text';

/**
 * What a render crash shows instead of a white screen. Exported as a route's
 * `ErrorBoundary`, so it may sit outside the providers the route set up: it
 * uses only the base theme, never the board palette or a query. The mascot
 * falls back to dez when the picker's provider isn't above it.
 */
export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const colors = useThemeColors();
  useEffect(() => reportError(error, { boundary: 'route' }), [error]);

  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
        <PhraseLettering phrase="somethingBroke" label="Something broke" />
        <MyMascot pose="emptyBare" width={MASCOT_WIDTH} />
      </View>
      <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
        Something broke while showing this screen. Try again, and if it keeps
        happening, close and reopen the app.
      </ThemedText>
      <Button title="Try again" size="sm" onPress={() => void retry()} />
    </View>
  );
}
