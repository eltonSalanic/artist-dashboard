import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { spacing, useThemeColors } from '@/theme';

/**
 * What stands between a form route and its form: permission, loading, and an
 * item that is not there. A form is reachable by URL, so a member can land on
 * an admin's form from a stale link — it says so rather than showing fields
 * the API would refuse.
 *
 * The form mounts only once its data has arrived, so it can take that data as
 * initial state instead of copying it in from an effect.
 */
export function FormGate({
  allowed,
  pending,
  missing,
  what,
  children,
}: {
  allowed: boolean;
  pending: boolean;
  missing: boolean;
  /** "task", "show", "goal" — for the copy. */
  what: string;
  children: ReactNode;
}) {
  const colors = useThemeColors();

  const message = !allowed
    ? `Only a band admin can do this. Ask one to change the ${what}.`
    : !pending && missing
      ? `This ${what} may have been deleted, or belongs to another band.`
      : null;

  if (message || pending) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
          padding: spacing.xl,
          backgroundColor: colors.background,
        }}
      >
        <Stack.Screen options={{ title: '' }} />
        {message ? (
          <>
            <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
              {message}
            </ThemedText>
            <Button title="Close" variant="ghost" size="sm" onPress={() => router.back()} />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  return children;
}
