import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMe } from '@artist/api-client';
import { supabase } from '@/lib/supabase';
import { radius, spacing, useTheme } from '@/theme';

/**
 * P5's only authed screen, and it exists to prove the seam rather than to be
 * used: if this renders the signed-in email and the caller's bands, then the
 * keychain session, the injected token, `@artist/api-client` under Metro and
 * the phone's route to the API are all working. The board UI starts at P7.
 */
export function HomeScreen() {
  const theme = useTheme();
  const me = useMe(true);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      {me.isPending ? (
        <ActivityIndicator color={theme.muted} />
      ) : me.isError ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.danger }]}>
            Could not reach the API
          </Text>
          <Text style={[styles.body, { color: theme.muted }]}>
            {me.error.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void me.refetch()}
            style={styles.inlineAction}
          >
            <Text style={[styles.inlineActionLabel, { color: theme.accent }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>
              {me.data.user.displayName}
            </Text>
            <Text style={[styles.body, { color: theme.muted }]}>
              {me.data.user.email}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.muted }]}>
            {me.data.boards.length === 1 ? 'Your band' : 'Your bands'}
          </Text>

          {me.data.boards.length === 0 ? (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.body, { color: theme.muted }]}>
                No bands yet. Signing in creates your first board, so this
                normally means the bootstrap call did not run.
              </Text>
            </View>
          ) : (
            me.data.boards.map((board) => (
              <View
                key={board.id}
                style={[styles.card, { backgroundColor: theme.card }]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {board.name}
                </Text>
                <Text style={[styles.body, { color: theme.muted }]}>
                  {board.role.toLowerCase()}
                </Text>
              </View>
            ))
          )}
        </>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => void supabase.auth.signOut()}
        style={({ pressed }) => [
          styles.signOut,
          { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.signOutLabel, { color: theme.danger }]}>
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm },
  card: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
  inlineAction: { marginTop: spacing.sm },
  inlineActionLabel: { fontSize: 14, fontWeight: '600' },
  signOut: {
    marginTop: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  signOutLabel: { fontSize: 15, fontWeight: '600' },
});
