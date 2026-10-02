import { router } from 'expo-router';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useCanChangeStatus, useChecklist, useTask } from '@artist/api-client';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Dot, Row } from '@/components/row';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { TaskAttachments } from '@/features/attachments/task-attachments';
import { dueDay, shortDate } from '@/features/board/format';
import { CommentsSection } from '@/features/comments/comments-section';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * One task. Status, checklist ticks, comments and attachments are writable
 * here; the task's own fields (title, description, dates, assignees) are an
 * admin's job and stay on web.
 *
 * Reached from any task row, and addressable, so a mention notification can
 * open the task it is about rather than the board root. Wrapped by its route
 * in `BoardPermissions`, so every control answers for this task's band.
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

  if (task.isPending) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      >
        <Skeleton width="80%" height={26} />
        <Skeleton width="40%" height={14} />
        <Skeleton width="100%" height={60} />
      </ScrollView>
    );
  }

  if (task.isError || !task.data) {
    return (
      <View style={center(colors.background)}>
        <Icon
          name={{ sf: 'questionmark.circle', md: 'help-outline' }}
          size={30}
          color={colors.mutedForeground}
        />
        <ThemedText variant="headline">Task not found</ThemedText>
        <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
          {/* Also what an archived or deleted task looks like, and what a
              notification for someone else's board looks like — the API 404s
              rather than confirming it exists. */}
          It may have been deleted, archived, or belong to another band.
        </ThemedText>
        <Button title="Go back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
    );
  }

  const t = task.data;
  const meta = [
    t.priority !== 'MEDIUM' ? `${t.priority.toLowerCase()} priority` : null,
    t.dueDate ? `due ${shortDate(dueDay(t.dueDate))}` : null,
  ].filter((part): part is string => part !== null);

  return (
    // The composer sits at the bottom of a long scroll, so the keyboard would
    // cover it. iOS's scroll view insets itself for the keyboard; Android is
    // edge-to-edge, where the window no longer resizes, so it gets padding.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={process.env.EXPO_OS === 'android' ? 'padding' : undefined}
    >
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
        <View style={{ gap: spacing.sm }}>
          <ThemedText variant="title">{t.title}</ThemedText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: spacing.sm,
            }}
          >
            <StatusButton
              name={t.status.name}
              color={t.status.color}
              onPress={
                canChangeStatus(t.assignees)
                  ? () => router.push(`/board/${boardId}/status/${t.id}`)
                  : undefined
              }
            />
            {meta.length > 0 && (
              <ThemedText variant="subhead" tone="muted">
                {meta.join(' · ')}
              </ThemedText>
            )}
          </View>
        </View>

        {t.description !== null && t.description.trim() !== '' && (
          <ThemedText variant="body">{t.description}</ThemedText>
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
            {t.goal && <Row first title={t.goal.title} meta="goal" />}
            {t.event && (
              <Row
                first={t.goal === null}
                title={t.event.title}
                meta={t.event.type.toLowerCase()}
                trailing={shortDate(t.event.startsAt)}
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

        {t.subtasks.length > 0 && (
          <Section title={`SUBTASKS · ${t.subtasks.length}`}>
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

        <ThemedText variant="footnote" tone="muted">
          Created by {t.createdBy.displayName}.
        </ThemedText>

        <TaskAttachments boardId={boardId} taskId={t.id} />

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
 */
function StatusButton({
  name,
  color,
  onPress,
}: {
  name: string;
  color: string;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`Status: ${name}`}
      accessibilityHint={onPress ? 'Changes the status' : undefined}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: pressed ? colors.accent : colors.muted,
      })}
    >
      <Dot color={color} />
      <ThemedText variant="subhead" style={{ fontWeight: '600' }}>
        {name}
      </ThemedText>
      {onPress && (
        <Icon
          name={{ sf: 'chevron.down', md: 'expand-more' }}
          size={12}
          color={colors.mutedForeground}
        />
      )}
    </Pressable>
  );
}

const center = (background: string) => ({
  flex: 1,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  gap: spacing.sm,
  padding: spacing.xl,
  backgroundColor: background,
});
