import { useLocalSearchParams } from 'expo-router';
import {
  EventTypes,
  FinanceKinds,
  NoteParentKinds,
  LinkParentKinds,
  type LinkParentKind,
  type EventType,
  type FinanceKind,
  type NoteParentKind,
} from '@artist/shared';
import { BoardPermissions } from '@/features/board/board-permissions';
import { EventForm } from '@/features/forms/event-form';
import { FinanceForm } from '@/features/forms/finance-form';
import { FocusForm } from '@/features/forms/focus-form';
import { GoalForm } from '@/features/forms/goal-form';
import { ItemLinkForm } from '@/features/forms/item-link-form';
import { ItemNoteForm } from '@/features/forms/item-note-form';
import { NoteForm } from '@/features/forms/note-form';
import { ReminderForm } from '@/features/forms/reminder-form';
import { SettleForm } from '@/features/forms/settle-form';
import { TaskForm } from '@/features/forms/task-form';

/**
 * `/board/:boardId/form/:kind` — every create and edit form, as a modal.
 *
 *   ?id=…            edit that item; absent, create one
 *   ?parentTaskId=…  a new subtask (kind `task`)
 *   ?goalId=…, ?eventId=…  a new task already linked to that goal or event
 *   ?type=SHOW|…     what a new event starts as (kind `event`)
 *   ?on=TASK|…&parentId=…  what a titled note hangs off (kind `item-note`)
 *   ?money=INCOME|EXPENSE  what a new ledger entry starts as (kind `finance`)
 *   ?eventId=…       the show a ledger entry belongs to, or the one to settle
 *
 * One route rather than ten: the forms share their frame, and the stack only
 * has to be told once that this is a modal.
 */
export default function Form() {
  const { boardId, kind, id, parentTaskId, goalId, eventId, type, on, parentId, money } =
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
      money?: string;
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
      case 'finance':
        return (
          <FinanceForm
            boardId={boardId}
            entryId={id}
            eventId={eventId}
            kind={
              (FinanceKinds as readonly string[]).includes(money ?? '')
                ? (money as FinanceKind)
                : undefined
            }
          />
        );
      case 'settle':
        return eventId ? <SettleForm boardId={boardId} eventId={eventId} /> : null;
      case 'item-link':
        return (LinkParentKinds as readonly string[]).includes(on ?? '') && parentId ? (
          <ItemLinkForm boardId={boardId} kind={on as LinkParentKind} parentId={parentId} />
        ) : null;
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
