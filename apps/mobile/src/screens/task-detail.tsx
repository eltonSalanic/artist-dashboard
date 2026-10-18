import { router, Stack } from 'expo-router';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  useCanChangeStatus,
  useChecklist,
  usePermissions,
  useTask,
} from '@artist/api-client';
import { Badge } from '@/components/badge';
import { Icon } from '@/components/icon';
import { PosterPill } from '@/components/poster-pill';
import { PosterText } from '@/components/poster-text';
import { Dot, Row } from '@/components/row';
import { Section } from '@/components/section';
import { TaskAttachments } from '@/features/attachments/task-attachments';
import {
  DetailLoading,
  DetailMissing,
  DetailPoster,
  HeaderEdit,
  PosterMeta,
} from '@/features/board/detail-poster';
import { dueDay, shortDate } from '@/features/board/format';
import { useWidgetInk } from '@/features/board/spoke-header';
import { CommentsSection } from '@/features/comments/comments-section';
import { radius, spacing, useThemeColors, type WidgetInk } from '@/theme';

/**
 * One task. Status, checklist ticks, comments and attachments are writable
 * here; the task's own fields (title, description, dates, assignees) are an
 * admin's job and stay on web.
 *
 * Reached from any task row, and addressable, so a mention notification can
 * open the task it is about rather than the board root. Wrapped by its route
 * in `BoardPermissions`, so every control answers for this task's band.
 *
 * The top is a block in the To-Do widget's colour — a due task wears the same
 * colour on the calendar — with the status pill on it.
 */
export function TaskDetailScreen({
  boardId,
  taskId,
}: {
  boardId: string;
  taskId: string;
}) {
  const colors = useThemeColors();
  const task = useTask(boardId, taskId);
  const checklist = useChecklist(boardId, taskId);
  const canChangeStatus = useCanChangeStatus();
  const { can } = usePermissions();
  const ink = useWidgetInk(boardId, 'TODOS');

  if (task.isPending) return <DetailLoading />;

  if (task.isError || !task.data) {
    return (
      <DetailMissing
        what="Task"
        // Also what a notification for someone else's board looks like.
        reason="It may have been deleted, archived, or belong to another band."
      />
    );
  }

  const t = task.data;
  const meta = [
    t.dueDate ? `Due ${shortDate(dueDay(t.dueDate))}` : null,
    t.priority !== 'MEDIUM' ? `${t.priority === 'HIGH' ? 'High' : 'Low'} priority` : null,
  ].filter((part): part is string => part !== null);

  return (
    // The composer sits at the bottom of a long scroll, so the keyboard would
    // cover it. iOS's scroll view insets itself for the keyboard; Android is
    // edge-to-edge, where the window no longer resizes, so it gets padding.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={process.env.EXPO_OS === 'android' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerRight: can('task.editFields')
            ? () => (
                <HeaderEdit
                  label="Edit task"
                  onPress={() => router.push(`/board/${boardId}/form/task?id=${t.id}`)}
                />
              )
            : undefined,
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        // A tap on "Comment" or a mention chip must land while the keyboard is
        // up, not just dismiss it.
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
      >
        <DetailPoster
          ink={ink}
          label={t.parentTaskId === null ? 'Task' : 'Subtask'}
          // Reached from the Archive; Edit → Unarchive brings it back.
          aside={t.archivedAt ? 'Archived' : null}
          title={t.title}
          done={t.status.isDone}
        >
          {meta.length > 0 && <PosterMeta ink={ink}>{meta.join(' · ')}</PosterMeta>}
          <StatusPill
            ink={ink}
            name={t.status.name}
            color={t.status.color}
            onPress={
              canChangeStatus(t.assignees)
                ? () => router.push(`/board/${boardId}/status/${t.id}`)
                : undefined
            }
          />
        </DetailPoster>

        {t.description !== null && t.description.trim() !== '' && (
          <PosterText variant="paragraph" color={colors.foreground}>
            {t.description}
          </PosterText>
        )}

        {t.assignees.length > 0 && (
          <Section title="ASSIGNED TO">
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.xs,
              }}
            >
              {t.assignees.map((person) => (
                <Badge key={person.id} label={person.displayName} />
              ))}
            </View>
          </Section>
        )}

        {(t.goal !== null || t.event !== null) && (
          <Section title="PART OF">
            {t.goal && (
              <Row
                first
                title={t.goal.title}
                meta="goal"
                onPress={() => router.push(`/board/${boardId}/goal/${t.goal!.id}`)}
              />
            )}
            {t.event && (
              <Row
                first={t.goal === null}
                title={t.event.title}
                meta={t.event.type.toLowerCase()}
                trailing={shortDate(t.event.startsAt)}
                onPress={() => router.push(`/board/${boardId}/event/${t.event!.id}`)}
              />
            )}
          </Section>
        )}

        {t.checklist.length > 0 && (
          <Section
            title={`CHECKLIST · ${t.checklist.filter((i) => i.done).length}/${t.checklist.length}`}
          >
            {t.checklist.map((item, index) => {
              // While a tick is in flight, show where it is going. The mutation
              // stays pending until the refetch lands, so this never flickers
              // back to the old value in between.
              const pending =
                checklist.update.isPending &&
                checklist.update.variables?.itemId === item.id;
              const done = pending
                ? (checklist.update.variables?.dto.done ?? item.done)
                : item.done;
              return (
                <Row
                  key={item.id}
                  first={index === 0}
                  title={item.text}
                  dim={done}
                  // Any member may tick an item — the API and web both allow it.
                  onPress={
                    pending
                      ? undefined
                      : () => {
                          void Haptics.selectionAsync();
                          checklist.update.mutate({
                            itemId: item.id,
                            dto: { done: !item.done },
                          });
                        }
                  }
                  lead={
                    <Icon
                      name={
                        done
                          ? { sf: 'checkmark.circle.fill', md: 'check-circle' }
                          : { sf: 'circle', md: 'radio-button-unchecked' }
                      }
                      size={17}
                      color={done ? colors.primary : undefined}
                    />
                  }
                />
              );
            })}
          </Section>
        )}

        {/* Web offers subtasks on root tasks only; so does this. */}
        {(t.subtasks.length > 0 || (t.parentTaskId === null && can('task.createSubtask'))) && (
          <Section
            title={t.subtasks.length > 0 ? `SUBTASKS · ${t.subtasks.length}` : 'SUBTASKS'}
            action={
              t.parentTaskId === null && can('task.createSubtask') ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add subtask"
                  hitSlop={10}
                  onPress={() =>
                    router.push(`/board/${boardId}/form/task?parentTaskId=${t.id}`)
                  }
                >
                  <PosterText variant="chip" color={colors.primary}>
                    Add
                  </PosterText>
                </Pressable>
              ) : undefined
            }
          >
            {t.subtasks.map((subtask, index) => (
              <Row
                key={subtask.id}
                first={index === 0}
                title={subtask.title}
                meta={subtask.status.name}
                dim={subtask.status.isDone}
                lead={<Dot color={subtask.status.color} />}
                trailing={subtask.dueDate ? shortDate(dueDay(subtask.dueDate)) : undefined}
                onPress={() => router.push(`/board/${boardId}/task/${subtask.id}`)}
              />
            ))}
          </Section>
        )}

        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          {`Created by ${t.createdBy.displayName}.`}
        </PosterText>

        <TaskAttachments boardId={boardId} parent={{ taskId: t.id }} />

        <CommentsSection boardId={boardId} taskId={t.id} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * The status, as the control that changes it. A pill with a chevron rather
 * than a bare dot: it has to read as tappable, and it is the one write a
 * member does most. Without permission it is the same pill, minus the chevron
 * and the press — still saying what the status is.
 *
 * The status's own colour is a dot ringed in the block's ink, since a status
 * colour was never picked to sit on a palette block.
 */
function StatusPill({
  ink,
  name,
  color,
  onPress,
}: {
  ink: WidgetInk;
  name: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <PosterPill
      ink={ink}
      label={name}
      accessibilityLabel={`Status: ${name}`}
      accessibilityHint={onPress ? 'Changes the status' : undefined}
      chevron={onPress !== undefined}
      onPress={onPress}
      lead={
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: ink.ink,
            backgroundColor: color,
          }}
        />
      }
    />
  );
}
