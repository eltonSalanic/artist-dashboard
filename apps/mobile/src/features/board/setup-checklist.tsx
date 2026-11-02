import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useBoard, useEvents, useInvites, useTasks } from '@artist/api-client';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { dismissSetup, setupDismissed } from '@/features/onboarding/onboarding-state';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * A small card at the top of a new band's hub: three first things to do, each
 * opening the real form. It ticks itself off from the band's own data and
 * goes away when all three are done, or when the owner closes it. Owners only:
 * a member arrives at a band that's already set up.
 */
export function SetupChecklist({ boardId }: { boardId: string }) {
  const colors = useThemeColors();
  const [dismissed, setDismissed] = useState(true);
  const board = useBoard(boardId);
  const invites = useInvites(boardId);
  const tasks = useTasks(boardId);
  const events = useEvents(boardId, { limit: 1 });

  useEffect(() => {
    void setupDismissed(boardId).then(setDismissed);
  }, [boardId]);

  const loaded = board.data && invites.data && tasks.data && events.data;
  if (dismissed || !loaded) return null;

  const steps = [
    {
      title: 'Invite your bandmates',
      done: board.data.members.length > 1 || invites.data.length > 0,
      href: `/board/${boardId}/settings?section=invite`,
    },
    {
      title: 'Add your next show',
      done: events.data.length > 0,
      href: `/board/${boardId}/form/event?type=SHOW`,
    },
    {
      title: 'Add a task and assign it',
      done: tasks.data.length > 0,
      href: `/board/${boardId}/form/task`,
    },
  ] as const;
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <ThemedText variant="caption" tone="muted">
          {`GET SET UP · ${doneCount} OF ${steps.length}`}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hide the setup list"
          hitSlop={12}
          onPress={() => {
            dismissSetup(boardId);
            setDismissed(true);
          }}
        >
          <Icon name={{ sf: 'xmark', md: 'close' }} size={12} color={colors.mutedForeground} />
        </Pressable>
      </View>
      {steps.map((step) => (
        <Pressable
          key={step.title}
          accessibilityRole="button"
          accessibilityLabel={step.title}
          accessibilityState={{ checked: step.done, disabled: step.done }}
          disabled={step.done}
          onPress={() => router.push(step.href)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View
            style={[
              styles.tick,
              step.done
                ? { backgroundColor: colors.primary }
                : { borderWidth: 1.5, borderColor: colors.mutedForeground },
            ]}
          >
            {step.done && (
              <Icon
                name={{ sf: 'checkmark', md: 'check' }}
                size={9}
                color={colors.primaryForeground}
              />
            )}
          </View>
          <ThemedText
            variant="footnote"
            tone={step.done ? 'muted' : undefined}
            style={[{ flex: 1 }, step.done && { textDecorationLine: 'line-through' }]}
          >
            {step.title}
          </ThemedText>
          {!step.done && (
            <Icon
              name={{ sf: 'chevron.right', md: 'chevron-right' }}
              size={11}
              color={colors.mutedForeground}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  tick: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
