import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useTask } from '@artist/api-client';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Dot, Row } from '@/components/row';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { shortDate } from '@/features/board/format';
import { spacing, useThemeColors } from '@/theme';

/**
 * One task, read-only. Editing — status, assignees, checklist, comments,
 * attachments — is P10.
 *
 * Reached from any task row, and addressable, so a mention notification can
 * open the task it is about rather than the board root.
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
        <Button
          title="Go back"
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const t = task.data;
  const meta = [
    t.status.name,
    t.priority !== 'MEDIUM' ? `${t.priority.toLowerCase()} priority` : null,
    t.dueDate ? `due ${shortDate(t.dueDate)}` : null,
  ].filter((part): part is string => part !== null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      <View style={{ gap: spacing.sm }}>
        <ThemedText variant="title">{t.title}</ThemedText>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
        >
          <Dot color={t.status.color} />
          <ThemedText variant="subhead" tone="muted">
            {meta.join(' · ')}
          </ThemedText>
        </View>
      </View>

      {t.description !== null && t.description.trim() !== '' && (
        <ThemedText variant="body">{t.description}</ThemedText>
      )}

      {t.assignees.length > 0 && (
        <Section title="ASSIGNED TO">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {t.assignees.map((person) => (
              <Badge key={person.id} label={person.displayName} />
            ))}
          </View>
        </Section>
      )}

      {(t.goal !== null || t.event !== null) && (
        <Section title="PART OF">
          {t.goal && (
            <Row first title={t.goal.title} meta="goal" />
          )}
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
          {t.checklist.map((item, index) => (
            <Row
              key={item.id}
              first={index === 0}
              title={item.text}
              dim={item.done}
              lead={
                <Icon
                  name={
                    item.done
                      ? { sf: 'checkmark.circle.fill', md: 'check-circle' }
                      : { sf: 'circle', md: 'radio-button-unchecked' }
                  }
                  size={15}
                />
              }
            />
          ))}
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
              trailing={subtask.dueDate ? shortDate(subtask.dueDate) : undefined}
              onPress={() =>
                router.push(`/board/${boardId}/task/${subtask.id}`)
              }
            />
          ))}
        </Section>
      )}

      <ThemedText variant="footnote" tone="muted">
        Created by {t.createdBy.displayName}. Editing, comments and attachments
        come to mobile in a later phase.
      </ThemedText>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <ThemedText variant="caption" tone="muted">
        {title}
      </ThemedText>
      {children}
    </View>
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
