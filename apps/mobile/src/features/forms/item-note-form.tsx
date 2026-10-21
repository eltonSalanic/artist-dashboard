import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { NOTE_EDIT_ACTION, type NoteDto, type NoteParentKind } from '@artist/shared';
import { useNotes, usePermissions } from '@artist/api-client';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { FormGate } from './form-gate';
import { FormScreen, useLeaveForm } from './form-screen';

/**
 * One titled note on a task, event, goal or reminder: a title and plain text.
 * New when `noteId` is absent. Not to be confused with `NoteForm`, the band's
 * Notes widget, which is a single rich document and stays as it was.
 */
export function ItemNoteForm({
  boardId,
  kind,
  parentId,
  noteId,
}: {
  boardId: string;
  kind: NoteParentKind;
  parentId: string;
  noteId?: string;
}) {
  const { can } = usePermissions();
  const notes = useNotes(boardId, kind, parentId);
  const note = noteId ? notes.data?.find((n) => n.id === noteId) : undefined;

  return (
    <FormGate
      allowed={can(NOTE_EDIT_ACTION[kind])}
      pending={!!noteId && notes.isPending}
      missing={!!noteId && !note}
      what="note"
    >
      <NoteFields notes={notes} note={note ?? null} />
    </FormGate>
  );
}

function NoteFields({
  notes,
  note,
}: {
  notes: ReturnType<typeof useNotes>;
  note: NoteDto | null;
}) {
  const leave = useLeaveForm();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const dirty = title !== (note?.title ?? '') || body !== (note?.body ?? '');

  const save = async () => {
    if (!note) {
      await notes.add.mutateAsync({ title: title.trim(), body });
    } else {
      await notes.update.mutateAsync({
        noteId: note.id,
        dto: {
          ...(title !== note.title && { title: title.trim() }),
          ...(body !== note.body && { body }),
        },
      });
    }
  };

  const confirmDelete = () =>
    Alert.alert(`Delete “${note!.title}”?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          notes.remove.mutate(note!.id, { onSuccess: () => leave(() => router.back()) }),
      },
    ]);

  return (
    <FormScreen
      title={note ? 'Edit note' : 'New note'}
      dirty={dirty}
      canSave={title.trim().length > 0 && (dirty || !note)}
      saving={notes.add.isPending || notes.update.isPending}
      onSave={save}
    >
      <TextField
        label="Title"
        placeholder="Setlist, gear, load-in…"
        value={title}
        onChangeText={setTitle}
        autoFocus={!note}
        maxLength={200}
        returnKeyType="next"
      />
      <TextField
        label="Note"
        placeholder="Write something…"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={10_000}
        style={{ minHeight: 200, textAlignVertical: 'top' }}
      />
      {note && (
        <Button
          title="Delete note"
          variant="destructive"
          size="sm"
          disabled={notes.remove.isPending}
          onPress={confirmDelete}
        />
      )}
    </FormScreen>
  );
}
