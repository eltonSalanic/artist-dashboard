import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMe } from '@artist/api-client';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { useSelectedBoard } from '@/features/board/selected-board';
import { PushSetting } from '@/features/push/push-prompt';
import { forgetThisDevice } from '@/features/push/push';
import { supabase } from '@/lib/supabase';
import { spacing, useThemeColors } from '@/theme';

/**
 * The account tab: who you are signed in as, which band the app is currently
 * showing, and the way out.
 *
 * This started life as P5's proof that the whole chain works — keychain
 * session, injected token, `@artist/api-client` under Metro, the phone's route
 * to the API — and it still is. It also holds this phone's notification
 * switch; which categories each band sends lives in that band's Settings.
 */
export function YouScreen() {
  const colors = useThemeColors();
  const me = useMe(true);
  const { board, boards } = useSelectedBoard();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      {me.isPending ? (
        <Card>
          <Skeleton width="60%" height={20} />
          <Skeleton width="80%" height={14} />
        </Card>
      ) : me.isError ? (
        <Card>
          <ThemedText variant="headline" tone="destructive">
            Could not reach the API
          </ThemedText>
          <ThemedText variant="subhead" tone="muted">
            {me.error.message}
          </ThemedText>
          <Button
            title="Try again"
            variant="ghost"
            size="sm"
            onPress={() => void me.refetch()}
            style={styles.retry}
          />
        </Card>
      ) : (
        <Card>
          <ThemedText variant="headline">{me.data.user.displayName}</ThemedText>
          <ThemedText variant="subhead" tone="muted">
            {me.data.user.email}
          </ThemedText>
        </Card>
      )}

      {board !== null && (
        <>
          <ThemedText variant="caption" tone="muted" style={styles.section}>
            SHOWING
          </ThemedText>
          <Card>
            <ThemedText variant="headline">{board.name}</ThemedText>
            <Badge label={board.role.toLowerCase()} />
            {boards.length > 1 && (
              <ThemedText variant="footnote" tone="muted">
                {boards.length} bands. Switch from the board name on the Board
                tab.
              </ThemedText>
            )}
          </Card>
        </>
      )}

      <ThemedText variant="caption" tone="muted" style={styles.section}>
        THIS PHONE
      </ThemedText>
      <PushSetting />

      <View style={styles.footer}>
        <Button
          title="Sign out"
          variant="destructive"
          loading={signingOut}
          onPress={() => {
            setSigningOut(true);
            // Unregistered first, while the session can still say whose
            // token it is — otherwise the next person to sign in on this
            // phone would be buzzed for this account until they did.
            void forgetThisDevice()
              .then(() => supabase.auth.signOut())
              .finally(() => setSigningOut(false));
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm },
  section: { marginTop: spacing.md, marginLeft: spacing.xs },
  retry: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  footer: { marginTop: spacing.xl },
});
