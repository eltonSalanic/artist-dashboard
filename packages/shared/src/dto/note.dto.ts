import { z } from 'zod';
import type { Action } from '../permissions';

/** The things a note can hang off. Shows, meetings and rehearsals are EVENT. */
export const NoteParentKinds = ['TASK', 'EVENT', 'GOAL', 'REMINDER'] as const;
export type NoteParentKind = (typeof NoteParentKinds)[number];

/** Who may add, edit or delete notes: whoever may edit the item itself. */
export const NOTE_EDIT_ACTION: Record<NoteParentKind, Action> = {
  TASK: 'task.editFields',
  EVENT: 'event.manage',
  GOAL: 'goal.manage',
  REMINDER: 'reminder.manage',
};

export const noteParentSchema = z.object({
  kind: z.enum(NoteParentKinds),
  parentId: z.uuid(),
});
export type NoteParentDto = z.infer<typeof noteParentSchema>;

export const createNoteSchema = noteParentSchema.extend({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(10_000).default(''),
});
export type CreateNoteDto = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().max(10_000),
  })
  .partial();
export type UpdateNoteDto = z.infer<typeof updateNoteSchema>;

export interface NoteDto {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
