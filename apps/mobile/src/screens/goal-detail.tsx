import { router, Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import { useGoal, usePermissions } from '@artist/api-client';
import type { GoalPeriod } from '@artist/shared';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import {
  DetailLoading,
  DetailMissing,
  DetailPoster,
  HeaderEdit,
  PosterMeta,
  PosterPill,
} from '@/features/board/detail-poster';
import { dueDay, shortDate } from '@/features/board/format';
import { useGoalCompletion } from '@/features/board/goal-completion';
import { useWidgetInk } from '@/features/board/spoke-header';
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
export function GoalDetailScreen({ boardId, goalId }: { boardId: string; goalId: string }) {
  const colors = useThemeColors();
  const goal = useGoal(boardId, goalId);
  const completion = useGoalCompletion(boardId);
  const ink = useWidgetInk(boardId, 'GOALS');
  const { can } = usePermissions();
  const canManage = can('goal.manage');

  if (goal.isPending) return <DetailLoading />;

  if (goal.isError || !goal.data) {
    return (
      <DetailMissing what="Goal" reason="It may have been deleted, or belong to another band." />
    );
  }

  const g = goal.data;
  const done = completion.pendingDone(g);
  const archived = g.archivedAt !== null;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight:
            canManage && !archived
              ? () => (
                  <HeaderEdit
                    label="Edit goal"
                    onPress={() => router.push(`/board/${boardId}/form/goal?id=${g.id}`)}
                  />
                )
              : undefined,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
      >
        <DetailPoster
          ink={ink}
          label={`${PERIOD_LABEL[g.period]} goal`}
          aside={archived ? 'Archived' : done ? 'Completed' : null}
          title={g.title}
          done={done}
        >
          {g.dueDate ? (
            <PosterMeta ink={ink}>{`Due ${shortDate(dueDay(g.dueDate))}`}</PosterMeta>
          ) : null}
          {canManage && !archived && (
            <PosterPill
              ink={ink}
              filled={!done}
              label={done ? 'Reopen goal' : 'Complete goal'}
              lead={
                <Icon
                  name={
                    done
                      ? { sf: 'arrow.uturn.backward', md: 'undo' }
                      : { sf: 'checkmark', md: 'check' }
                  }
                  size={14}
                  color={done ? ink.ink : ink.bg}
                />
              }
              disabled={completion.isPending}
              onPress={() => completion.toggle(g)}
            />
          )}
        </DetailPoster>

        {g.description !== null && g.description.trim() !== '' && (
          <PosterText variant="paragraph" color={colors.foreground}>
            {g.description}
          </PosterText>
        )}

        <LinkedTasks boardId={boardId} link={{ goalId: g.id }} archived={archived} />
      </ScrollView>
    </>
  );
}
