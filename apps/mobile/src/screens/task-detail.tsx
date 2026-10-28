import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  useCanChangeStatus,
  useChecklist,
  usePermissions,
  useTask,
} from '@artist/api-client';
import { TextInput } from '@/components/text-input';
import { Badge } from '@/components/badge';
import { Icon } from '@/components/icon';
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
import { StatusPill } from '@/features/board/status-pill';
import { ItemLinksSection } from '@/features/item-links/item-links-section';
import { ItemNotesSection } from '@/features/item-notes/item-notes-section';
import { CommentsSection } from '@/features/comments/comments-section';
import {
  posterInput,
  posterRadius,
  spacing,
  useThemeColors,
  useTokens,
} from '@/theme';

/**
 * One task. Status, the checklist, comments and attachments are writable
 * here by any member; the task's own fields (title, description, dates,
 * assignees) are an admin's, behind Edit.
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

        <ItemNotesSection
          boardId={boardId}
          kind="TASK"
          parentId={t.id}
          canEdit={can('task.editFields')}
        />

        <ItemLinksSection boardId={boardId} kind="TASK" parentId={t.id} />

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

        <ChecklistSection boardId={boardId} taskId={t.id} items={t.checklist} />

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
 * The checklist: tick, add and remove, as on web, where any member may do all
 * three (the API gates none of them). Always drawn, even empty — the add field
 * is how a checklist starts.
 *
 * Remove is a quiet × at the row's end rather than a swipe: web deletes on one
 * click with no confirmation, and a swipe would be the only one on these
 * screens.
 */
function ChecklistSection({
  boardId,
  taskId,
  items,
}: {
  boardId: string;
  taskId: string;
  items: { id: string; text: string; done: boolean }[];
}) {
  const tokens = useTokens();
  const checklist = useChecklist(boardId, taskId);
  const [draft, setDraft] = useState('');
  const done = items.filter((i) => i.done).length;

  // Return hands over the field's own text: `draft` can trail a fast typist
  // (or a paste) by a keystroke. Only that text is cleared once it saves, so
  // anything typed while it was saving stays in the field.
  const add = (typed: string = draft) => {
    const text = typed.trim();
    if (!text || checklist.add.isPending) return;
    checklist.add.mutate(text, {
      onSuccess: () => setDraft((current) => (current.trim() === text ? '' : current)),
    });
  };

  return (
    <Section title={items.length > 0 ? `CHECKLIST · ${done}/${items.length}` : 'CHECKLIST'}>
      {items.map((item, index) => {
        // While a tick is in flight, show where it is going. The mutation
        // stays pending until the refetch lands, so this never flickers
        // back to the old value in between.
        const pending =
          checklist.update.isPending && checklist.update.variables?.itemId === item.id;
        const removing =
          checklist.remove.isPending && checklist.remove.variables === item.id;
        const ticked = pending ? (checklist.update.variables?.dto.done ?? item.done) : item.done;
        return (
          <Row
            key={item.id}
            first={index === 0}
            title={item.text}
            dim={ticked || removing}
            onPress={
              pending || removing
                ? undefined
                : () => {
                    void Haptics.selectionAsync();
                    checklist.update.mutate({ itemId: item.id, dto: { done: !item.done } });
                  }
            }
            accessibilityActions={[{ name: 'delete', label: 'Remove item' }]}
            onAccessibilityAction={(name) => {
              if (name === 'delete') checklist.remove.mutate(item.id);
            }}
            lead={
              <Icon
                name={
                  ticked
                    ? { sf: 'checkmark.circle.fill', md: 'check-circle' }
                    : { sf: 'circle', md: 'radio-button-unchecked' }
                }
                size={17}
                color={ticked ? tokens.primary : undefined}
              />
            }
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.text}`}
                hitSlop={10}
                disabled={removing}
                onPress={() => {
                  void Haptics.selectionAsync();
                  checklist.remove.mutate(item.id);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: spacing.xs })}
              >
                <Icon name={{ sf: 'xmark', md: 'close' }} size={14} color={tokens.mutedForeground} />
              </Pressable>
            }
          />
        );
      })}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: items.length > 0 ? spacing.xs : 0,
        }}
      >
        <TextInput
          accessibilityLabel="New checklist item"
          placeholder="Add checklist item…"
          placeholderTextColor={tokens.mutedForeground}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={(event) => add(event.nativeEvent.text)}
          // Keep the keyboard up, so a list can be typed in one go.
          submitBehavior="submit"
          returnKeyType="done"
          // Never locked while saving: on iOS a field made uneditable loses
          // focus, which would drop the keyboard between items.
          style={[
            posterInput,
            {
              flex: 1,
              color: tokens.foreground,
              backgroundColor: tokens.muted,
              borderRadius: posterRadius.block,
              borderCurve: 'continuous',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 3,
            },
          ]}
        />
        {draft.trim() !== '' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add checklist item"
            hitSlop={10}
            disabled={checklist.add.isPending}
            onPress={() => add()}
          >
            <PosterText variant="chip" color={tokens.primary}>
              {checklist.add.isPending ? 'Adding…' : 'Add'}
            </PosterText>
          </Pressable>
        )}
      </View>
    </Section>
  );
}

