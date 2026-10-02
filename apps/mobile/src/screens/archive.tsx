import { useState } from 'react';
import { router } from 'expo-router';
import {
  CALENDAR_CATEGORY_COPY,
  CalendarCategories,
  calendarCategory,
  type CalendarCategory,
} from '@artist/shared';
import { useArchive, usePermissions, type ArchiveItemDto } from '@artist/api-client';
import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { dueDay, shortAgo, shortDate } from '@/features/board/format';

/** The one line of context each kind carries, as on web's archive page. */
function detail(item: ArchiveItemDto): string {
  const parts: string[] = [];
  if (item.date) {
    // Task and goal dates are calendar days; events and reminders are instants.
    parts.push(
      shortDate(item.kind === 'TASK' || item.kind === 'GOAL' ? dueDay(item.date) : item.date),
    );
  }
  if (item.task) parts.push(item.task.statusName);
  if (item.event?.location) parts.push(item.event.location);
  return parts.join(' · ');
}

const category = (item: ArchiveItemDto) =>
  calendarCategory({ kind: item.kind, date: item.date ?? '', event: item.event });

/**
 * Everything put away, newest first, and the way back. Every member can browse
 * it (`archive.view`); bringing something back is in the item's own form, where
 * the "and its N tasks" choice already lives.
 *
 * The filter is web's additive chips — none picked means everything. Web's
 * year and day filters are left out: on a phone, two more controls above a list
 * that is usually short cost more than they save.
 */
export function ArchiveScreen({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const archive = useArchive(boardId);
  const [selected, setSelected] = useState<CalendarCategory[]>([]);

  const items = archive.data ?? [];
  const visible =
    selected.length === 0 ? items : items.filter((i) => selected.includes(category(i)));

  // Archived tasks open their task screen, which anyone may read. The rest
  // open their edit form, which only an admin can use — for a member those
  // rows are a record, not a door.
  const open = (item: ArchiveItemDto) => {
    if (item.kind === 'TASK') return router.push(`/board/${boardId}/task/${item.id}`);
    const kind = item.kind.toLowerCase();
    router.push(`/board/${boardId}/form/${kind}?id=${item.id}`);
  };
  const canOpen = (item: ArchiveItemDto) =>
    item.kind === 'TASK' ||
    can(
      item.kind === 'EVENT'
        ? 'event.manage'
        : item.kind === 'GOAL'
          ? 'goal.manage'
          : 'reminder.manage',
    );

  return (
    <SpokeList
      pending={archive.isPending}
      error={archive.error}
      onRetry={() => void archive.refetch()}
      empty={visible.length === 0}
      emptyIcon={{ sf: 'archivebox', md: 'archive' }}
      emptyTitle={items.length === 0 ? 'Nothing archived yet' : 'No matches'}
      emptyBody={
        items.length === 0
          ? 'Archive a task, goal, show or reminder to clear it off the dashboard without losing it.'
          : 'Nothing archived matches these filters.'
      }
      header={
        items.length > 0 ? (
          <>
            <ChoiceChips
              label={`${visible.length} of ${items.length}`}
              multiple
              choices={CalendarCategories.map((c) => ({
                value: c,
                label: CALENDAR_CATEGORY_COPY[c].label,
              }))}
              value={selected}
              onChange={setSelected}
            />
            {selected.length > 0 && visible.length === 0 && (
              <Button
                title="Clear filters"
                variant="ghost"
                size="sm"
                onPress={() => setSelected([])}
              />
            )}
          </>
        ) : undefined
      }
    >
      {visible.map((item, index) => {
        const kind = category(item);
        return (
          <Row
            key={`${item.kind}-${item.id}`}
            first={index === 0}
            title={item.title}
            meta={[
              // "Due" is the calendar's word for a task; here it is a task.
              kind === 'TASK' ? 'Task' : CALENDAR_CATEGORY_COPY[kind].one,
              detail(item),
            ]
              .filter(Boolean)
              .join(' · ')}
            trailing={shortAgo(item.archivedAt)}
            onPress={canOpen(item) ? () => open(item) : undefined}
          />
        );
      })}
    </SpokeList>
  );
}
