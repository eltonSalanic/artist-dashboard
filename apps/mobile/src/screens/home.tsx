import { ScrollView, StyleSheet, View } from 'react-native';
import { resolveBoardTheme } from '@artist/shared';
import { useMe } from '@artist/api-client';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { BoardPaletteProvider, spacing, useThemeColors } from '@/theme';

/** Rotated per row so neighbouring cards never land on the same weight. */
const slots = ['c1', 'c2', 'c3', 'c4'] as const;

/**
 * P5's only authed screen, and it exists to prove the seam rather than to be
 * used: if this renders the signed-in email and the caller's bands, then the
 * keychain session, the injected token, `@artist/api-client` under Metro and
 * the phone's route to the API are all working.
 *
 * P6 added the second job — the band list is painted from the board's palette,
 * which is the first thing in the app to render out of the shared colour
 * tables. The board UI proper starts at P7.
 */
export function HomeScreen() {
  const colors = useThemeColors();
  const me = useMe(true);
  const palette = resolveBoardTheme(me.data?.board?.theme).palette;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {me.isPending ? (
        <>
          <Card>
            <Skeleton width="60%" height={20} />
            <Skeleton width="80%" height={14} />
          </Card>
          <Card>
            <Skeleton width="45%" height={20} />
          </Card>
        </>
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
        <>
          <Card>
            <ThemedText variant="headline">
              {me.data.user.displayName}
            </ThemedText>
            <ThemedText variant="subhead" tone="muted">
              {me.data.user.email}
            </ThemedText>
          </Card>

          <ThemedText variant="caption" tone="muted" style={styles.section}>
            {me.data.boards.length === 1 ? 'YOUR BAND' : 'YOUR BANDS'}
          </ThemedText>

          {me.data.boards.length === 0 ? (
            <Card>
              <ThemedText variant="subhead" tone="muted">
                No bands yet. Signing in creates your first board, so this
                normally means the bootstrap call did not run.
              </ThemedText>
            </Card>
          ) : (
            // One palette for the list: `BoardSummaryDto` carries id, name and
            // role and deliberately no theme, so listing twenty bands does not
            // fetch twenty palettes. The current board's palette is the one
            // `/me` returns in full, and the slot rotates so rows alternate
            // weight the way the web grid does.
            <BoardPaletteProvider palette={palette}>
              {me.data.boards.map((board, index) => (
                <Card key={board.id} slot={slots[index % slots.length]}>
                  <ThemedText variant="headline">{board.name}</ThemedText>
                  <Badge label={board.role.toLowerCase()} />
                </Card>
              ))}
            </BoardPaletteProvider>
          )}
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
