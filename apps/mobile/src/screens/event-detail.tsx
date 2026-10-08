import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useEvent, usePermissions } from '@artist/api-client';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { TaskAttachments } from '@/features/attachments/task-attachments';
import { dayHeading, timeOfDay } from '@/features/board/format';
import { spacing, useThemeColors } from '@/theme';

const TYPE_TITLE = { SHOW: 'Show', REHEARSAL: 'Rehearsal', MEETING: 'Meeting' } as const;

/**
 * One show, rehearsal or meeting: when, where, the notes, and its files.
 *
 * It exists for the files. A show's rider, stage plot and setlist are what
 * the whole band needs on the day, and before this the only way into an event
 * on the phone was the admin's edit form, so a member could not reach them.
 * Read-only otherwise; Edit in the header opens that form for whoever may
 * change events. Wrapped by its route in `BoardPermissions`.
 */
export function EventDetailScreen({
  boardId,
  eventId,
}: {
  boardId: string;
  eventId: string;
}) {
  const colors = useThemeColors();
  const event = useEvent(boardId, eventId);
  const { can } = usePermissions();

  if (event.isPending) {
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

  if (event.isError || !event.data) {
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
        <ThemedText variant="headline">Event not found</ThemedText>
        <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
          It may have been deleted, or belong to another band.
        </ThemedText>
        <Button title="Go back" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>
    );
  }

  const e = event.data;
  const starts = new Date(e.startsAt);
  const when = [
    dayHeading(starts),
    // An end equal to the start is "no end set", not a zero-length show.
    e.endsAt && e.endsAt !== e.startsAt
      ? `${timeOfDay(e.startsAt)} – ${timeOfDay(e.endsAt)}`
      : timeOfDay(e.startsAt),
  ].join(' · ');

  return (
    <>
      <Stack.Screen
        options={{
          title: TYPE_TITLE[e.type],
          headerRight: can('event.manage')
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${TYPE_TITLE[e.type].toLowerCase()}`}
                  hitSlop={10}
                  onPress={() => router.push(`/board/${boardId}/form/event?id=${e.id}`)}
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
          <ThemedText variant="title">{e.title}</ThemedText>
          <ThemedText variant="subhead" tone="muted">
            {when}
          </ThemedText>
          {e.location && (
            <ThemedText variant="subhead" tone="muted">
              {e.location}
            </ThemedText>
          )}
        </View>

        {e.description !== null && e.description.trim() !== '' && (
          <ThemedText variant="body">{e.description}</ThemedText>
        )}

        <TaskAttachments boardId={boardId} parent={{ eventId: e.id }} />
      </ScrollView>
    </>
  );
}
