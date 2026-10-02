import { useLocalSearchParams } from 'expo-router';
import { EventTypes, type EventType } from '@artist/shared';
import { BoardPermissions } from '@/features/board/board-permissions';
import { EventForm } from '@/features/forms/event-form';
import { FocusForm } from '@/features/forms/focus-form';
import { GoalForm } from '@/features/forms/goal-form';
import { NoteForm } from '@/features/forms/note-form';
import { ReminderForm } from '@/features/forms/reminder-form';
import { TaskForm } from '@/features/forms/task-form';

/**
 * `/board/:boardId/form/:kind` — every create and edit form, as a modal.
 *
 *   ?id=…            edit that item; absent, create one
 *   ?parentTaskId=…  a new subtask (kind `task`)
 *   ?type=SHOW|…     what a new event starts as (kind `event`)
 *
 * One route rather than ten: the forms share their frame, and the stack only
 * has to be told once that this is a modal.
 */
export default function Form() {
  const { boardId, kind, id, parentTaskId, type } = useLocalSearchParams<{
    boardId: string;
    kind: string;
    id?: string;
    parentTaskId?: string;
    type?: string;
  }>();

  // Query parameters come from a URL, so they can be anything.
  const eventType = (EventTypes as readonly string[]).includes(type ?? '')
    ? (type as EventType)
    : undefined;

  const form = (() => {
    switch (kind) {
      case 'event':
        return <EventForm boardId={boardId} eventId={id} type={eventType} />;
      case 'reminder':
        return <ReminderForm boardId={boardId} reminderId={id} />;
      case 'goal':
        return <GoalForm boardId={boardId} goalId={id} />;
      case 'focus':
        return <FocusForm boardId={boardId} />;
      case 'note':
        return <NoteForm boardId={boardId} />;
      default:
        return <TaskForm boardId={boardId} taskId={id} parentTaskId={parentTaskId} />;
    }
  })();

  return <BoardPermissions boardId={boardId}>{form}</BoardPermissions>;
}
