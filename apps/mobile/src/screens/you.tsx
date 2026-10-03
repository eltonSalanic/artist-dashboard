import { ScrollView, StyleSheet, View } from 'react-native';
import { useMe } from '@artist/api-client';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { useSelectedBoard } from '@/features/board/selected-board';
import { supabase } from '@/lib/supabase';
import { spacing, useThemeColors } from '@/theme';

/**
 * The account tab: who you are signed in as, which band the app is currently
 * showing, and the way out.
 *
 * This started life as P5's proof that the whole chain works — keychain
 * session, injected token, `@artist/api-client` under Metro, the phone's route
 * to the API — and it still is. Notification preferences and a profile editor
 * belong here later.
 */
export function YouScreen() {
  const colors = useThemeColors();
  const me = useMe(true);
  const { board, boards } = useSelectedBoard();

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

      <View style={styles.footer}>
        <Button
          title="Sign out"
          variant="destructive"
          onPress={() => void supabase.auth.signOut()}
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
