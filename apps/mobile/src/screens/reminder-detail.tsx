import { router, Stack } from 'expo-router';
import { ScrollView } from 'react-native';
import { usePermissions, useReminder, useUpdateReminder } from '@artist/api-client';
import { Icon } from '@/components/icon';
import { PosterPill } from '@/components/poster-pill';
import { PosterText } from '@/components/poster-text';
import {
  DetailLoading,
  DetailMissing,
  DetailPoster,
  HeaderEdit,
  PosterMeta,
} from '@/features/board/detail-poster';
import { shortDate, timeOfDay } from '@/features/board/format';
import { useWidgetInk } from '@/features/board/spoke-header';
import { spacing, useThemeColors } from '@/theme';

/**
 * One reminder, read in full — web's reminder modal. The list row shows one
 * line of the description; this is where the rest of it is, for every member,
 * not only the ones who may edit it.
 *
 * Edit in the header and the done button are for whoever may manage
 * reminders. Wrapped by its route in `BoardPermissions`.
 */
export function ReminderDetailScreen({
  boardId,
  reminderId,
}: {
  boardId: string;
  reminderId: string;
}) {
  const colors = useThemeColors();
  const reminder = useReminder(boardId, reminderId);
  const update = useUpdateReminder(boardId);
  const ink = useWidgetInk(boardId, 'REMINDERS');
  const { can } = usePermissions();
  const canManage = can('reminder.manage');

  if (reminder.isPending) return <DetailLoading />;

  if (reminder.isError || !reminder.data) {
    return (
      <DetailMissing what="Reminder" reason="It may have been deleted, or belong to another band." />
    );
  }

  const r = reminder.data;
  const archived = r.archivedAt !== null;
  // A tick in flight shows where it is going.
  const done = update.isPending ? (update.variables?.dto.done ?? r.done) : r.done;
  const overdue = !done && r.remindAt !== null && new Date(r.remindAt) <= new Date();

  return (
    <>
      <Stack.Screen
        options={{
          headerRight:
            canManage && !archived
              ? () => (
                  <HeaderEdit
                    label="Edit reminder"
                    onPress={() => router.push(`/board/${boardId}/form/reminder?id=${r.id}`)}
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
          label="Reminder"
          aside={archived ? 'Archived' : done ? 'Done' : overdue ? 'Due' : null}
          title={r.title}
          done={done}
        >
          <PosterMeta ink={ink}>
            {r.remindAt
              ? `${shortDate(r.remindAt)} · ${timeOfDay(r.remindAt)}`
              : 'No date — a standing note'}
          </PosterMeta>
          {canManage && !archived && (
            <PosterPill
              ink={ink}
              filled={!done}
              label={done ? 'Mark not done' : 'Mark done'}
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
              disabled={update.isPending}
              onPress={() => update.mutate({ reminderId: r.id, dto: { done: !r.done } })}
            />
          )}
        </DetailPoster>

        {r.description !== null && r.description.trim() !== '' ? (
          <PosterText variant="paragraph" color={colors.foreground}>
            {r.description}
          </PosterText>
        ) : (
          <PosterText variant="cardMeta" color={colors.mutedForeground}>
            No description.
          </PosterText>
        )}
      </ScrollView>
    </>
  );
}
