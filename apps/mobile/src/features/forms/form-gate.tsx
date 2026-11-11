import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { adminOnlyMessage } from '@artist/shared';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { useAdminNames } from '@/features/help/use-admin-names';
import { spacing, useThemeColors } from '@/theme';

/**
 * What stands between a form route and its form: permission, loading, and an
 * item that is not there. A form is reachable by URL, so a member can land on
 * an admin's form from a stale link — it says so rather than showing fields
 * the API would refuse, and names the admins to ask.
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
  // Every form lives under `/board/:boardId/form/…`.
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const admins = useAdminNames(boardId);

  const message = !allowed
    ? adminOnlyMessage(`add or change ${/^[aeiou]/.test(what) ? 'an' : 'a'} ${what}`, admins)
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
