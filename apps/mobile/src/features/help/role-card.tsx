import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { orList, roleIntro, type BoardRole } from '@artist/shared';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { face, radius, spacing, useThemeColors } from '@/theme';
import { useAdminNames } from './use-admin-names';

/**
 * A small card at the top of the hub the first time someone opens a band they
 * don't own: what their role lets them do, who the admins are, and the way to
 * the two things worth reading (who can do what, how the books work). Set as
 * the owner's "Get set up" card is, and closed for good with its X.
 *
 * Shown for the role, so someone made an admin later sees the admin version
 * once.
 */
export function RoleCard({
  boardId,
  role,
  onDismiss,
}: {
  boardId: string;
  role: BoardRole;
  onDismiss: () => void;
}) {
  const colors = useThemeColors();
  const intro = roleIntro(role, false);
  const admins = useAdminNames(boardId);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <ThemedText variant="caption" tone="muted">
          HOW THIS BAND WORKS
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide this card"
          hitSlop={12}
          onPress={onDismiss}
        >
          <Icon name={{ sf: 'xmark', md: 'close' }} size={12} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <View style={{ gap: 2 }}>
        <ThemedText variant="headline" accessibilityRole="header">
          {intro.title}
        </ThemedText>
        <ThemedText variant="footnote" tone="muted">
          {intro.body}
          {role === 'USER' && admins.length > 0
            ? ` The admins here: ${orList(admins).replace(' or ', ' and ')}.`
            : ''}
        </ThemedText>
      </View>
      <View style={styles.links}>
        <CardLink
          title={role === 'USER' ? 'What can admins do?' : 'Who can do what'}
          onPress={() => router.push('/help/roles')}
        />
        <CardLink title="How the books work" onPress={() => router.push('/help/books')} />
      </View>
    </View>
  );
}

function CardLink({ title, onPress }: { title: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
    >
      <ThemedText variant="footnote" tone="accent" style={{ fontFamily: face.semi }}>
        {title}
      </ThemedText>
      <Icon name={{ sf: 'chevron.right', md: 'chevron-right' }} size={10} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    paddingTop: spacing.xs,
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
});
