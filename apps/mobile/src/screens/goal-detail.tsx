import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useGoal, usePermissions } from '@artist/api-client';
import type { GoalPeriod } from '@artist/shared';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { dueDay, shortDate } from '@/features/board/format';
import { useGoalCompletion } from '@/features/board/goal-completion';
import { LinkedTasks } from '@/features/links/linked-tasks';
import { spacing, useThemeColors } from '@/theme';

// Web's labels (`goalPeriodLabel`), as in the goal form.
const PERIOD_LABEL: Record<GoalPeriod, string> = {
  YEARLY: 'Yearly',
  MONTHLY: 'Monthly',
  DAILY: 'Daily',
};

/**
 * One goal and the tasks that make it up — the phone had the goal's fields
 * (its edit form) but nowhere to see what it was made of, so completing a
 * goal finished tasks nobody on the phone could see.
 *
 * Open to every member. Edit in the header and the complete button are for
 * whoever may manage goals; linking tasks is for whoever may edit tasks.
 * Wrapped by its route in `BoardPermissions`.
 */
export function GoalDetailScreen({
  boardId,
  goalId,
}: {
  boardId: string;
  goalId: string;
}) {
  const colors = useThemeColors();
  const goal = useGoal(boardId, goalId);
  const completion = useGoalCompletion(boardId);
  const { can } = usePermissions();
  const canManage = can('goal.manage');

  if (goal.isPending) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      >
        <Skeleton width="70%" height={26} />
        <Skeleton width="45%" height={14} />
        <Skeleton width="100%" height={60} />
      </ScrollView>
    );
  }

  if (goal.isError || !goal.data) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          padding: spacing.xl,
          backgroundColor: colors.background,
        }}
      >
        <Icon
          name={{ sf: 'questionmark.circle', md: 'help-outline' }}
          size={30}
          color={colors.mutedForeground}
        />
        <ThemedText variant="headline">Goal not found</ThemedText>
        <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
          It may have been deleted, or belong to another band.
        </ThemedText>
        <Button title="Go back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
    );
  }

  const g = goal.data;
  const done = completion.pendingDone(g);
  const archived = g.archivedAt !== null;
  const when = [
    PERIOD_LABEL[g.period],
    g.dueDate ? `due ${shortDate(dueDay(g.dueDate)).toLowerCase()}` : null,
    done ? 'completed' : null,
    archived ? 'archived' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Goal',
          headerRight:
            canManage && !archived
              ? () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit goal"
                    hitSlop={10}
                    onPress={() => router.push(`/board/${boardId}/form/goal?id=${g.id}`)}
                  >
                    <ThemedText variant="body" style={{ color: colors.primary }}>
                      Edit
                    </ThemedText>
                  </Pressable>
                )
              : undefined,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
      >
        <View style={{ gap: spacing.xs }}>
          <ThemedText
            variant="title"
            style={done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
          >
            {g.title}
          </ThemedText>
          <ThemedText variant="subhead" tone="muted">
            {when}
          </ThemedText>
        </View>

        {g.description !== null && g.description.trim() !== '' && (
          <ThemedText variant="body">{g.description}</ThemedText>
        )}

        {canManage && !archived && (
          <Button
            title={done ? 'Reopen goal' : 'Complete goal'}
            variant={done ? 'ghost' : 'primary'}
            size="sm"
            disabled={completion.isPending}
            onPress={() => completion.toggle(g)}
          />
        )}

        <LinkedTasks boardId={boardId} link={{ goalId: g.id }} archived={archived} />
      </ScrollView>
    </>
  );
}
