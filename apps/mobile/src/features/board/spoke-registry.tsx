import type { ComponentType } from 'react';
import type { WidgetType } from '@artist/shared';
import { ActivitySpoke } from './spokes/activity';
import { makeEventsSpoke } from './spokes/events';
import { FinancesSpoke } from './spokes/finances';
import { FocusSpoke } from './spokes/focus';
import { GoalsSpoke } from './spokes/goals';
import { NoteSpoke } from './spokes/note';
import { RemindersSpoke } from './spokes/reminders';
import { MyTasksSpoke, TodosSpoke } from './spokes/tasks';

export interface SpokeProps {
  boardId: string;
}

/**
 * The expanded view of each widget — native's answer to the registry's
 * `Expanded` components. Read-only: writing is P10, and the note's editor is
 * P11, which is why `CUSTOM` renders text rather than an editor.
 *
 * `CALENDAR` is absent on purpose, as it is on web: it is a tab, not a widget.
 */
export const SPOKES: Partial<Record<WidgetType, ComponentType<SpokeProps>>> = {
  FOCUS: FocusSpoke,
  TODOS: TodosSpoke,
  MY_TASKS: MyTasksSpoke,
  GOALS: GoalsSpoke,
  SHOWS: makeEventsSpoke('SHOW'),
  NEXT_REHEARSALS: makeEventsSpoke('REHEARSAL'),
  NEXT_MEETINGS: makeEventsSpoke('MEETING'),
  REMINDERS: RemindersSpoke,
  ACTIVITY_FEED: ActivitySpoke,
  CUSTOM: NoteSpoke,
  FINANCES: FinancesSpoke,
};
