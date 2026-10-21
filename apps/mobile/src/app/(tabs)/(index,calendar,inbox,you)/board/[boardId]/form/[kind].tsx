import { useLocalSearchParams } from 'expo-router';
import {
  EventTypes,
  NoteParentKinds,
  type EventType,
  type NoteParentKind,
} from '@artist/shared';
import { BoardPermissions } from '@/features/board/board-permissions';
import { EventForm } from '@/features/forms/event-form';
import { FocusForm } from '@/features/forms/focus-form';
import { GoalForm } from '@/features/forms/goal-form';
import { ItemNoteForm } from '@/features/forms/item-note-form';
import { NoteForm } from '@/features/forms/note-form';
import { ReminderForm } from '@/features/forms/reminder-form';
import { TaskForm } from '@/features/forms/task-form';

/**
 * `/board/:boardId/form/:kind` — every create and edit form, as a modal.
 *
 *   ?id=…            edit that item; absent, create one
 *   ?parentTaskId=…  a new subtask (kind `task`)
 *   ?goalId=…, ?eventId=…  a new task already linked to that goal or event
 *   ?type=SHOW|…     what a new event starts as (kind `event`)
 *   ?on=TASK|…&parentId=…  what a titled note hangs off (kind `item-note`)
 *
 * One route rather than ten: the forms share their frame, and the stack only
 * has to be told once that this is a modal.
 */
export default function Form() {
  const { boardId, kind, id, parentTaskId, goalId, eventId, type, on, parentId } =
    useLocalSearchParams<{
      boardId: string;
      kind: string;
      id?: string;
      parentTaskId?: string;
      goalId?: string;
      eventId?: string;
      type?: string;
      on?: string;
      parentId?: string;
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
      case 'item-note':
        return (NoteParentKinds as readonly string[]).includes(on ?? '') && parentId ? (
          <ItemNoteForm
            boardId={boardId}
            kind={on as NoteParentKind}
            parentId={parentId}
            noteId={id}
          />
        ) : null;
      default:
        return (
          <TaskForm
            boardId={boardId}
            taskId={id}
            parentTaskId={parentTaskId}
            goalId={goalId}
            eventId={eventId}
          />
        );
    }
  })();

  return <BoardPermissions boardId={boardId}>{form}</BoardPermissions>;
}
