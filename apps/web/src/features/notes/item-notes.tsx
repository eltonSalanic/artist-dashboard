"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { NoteDto, NoteParentKind } from "@artist/shared";
import { useNotes } from "@artist/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { labelStyle } from "@/lib/label-style";

/**
 * The titled notes on a task, event, goal or reminder. Replaced the single
 * description box: an item can carry several notes (setlist, gear, load-in…),
 * each saved on blur like the rest of the detail modals.
 */
export function ItemNotes({
  boardId,
  kind,
  parentId,
  canEdit,
  headingClassName = labelStyle,
}: {
  boardId: string;
  kind: NoteParentKind;
  parentId: string;
  canEdit: boolean;
  headingClassName?: string;
}) {
  const notes = useNotes(boardId, kind, parentId);
  const [newTitle, setNewTitle] = useState("");

  return (
    <section className="flex flex-col gap-3" aria-label="Notes">
      <h3 className={headingClassName}>Notes</h3>
      {notes.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : notes.data?.length ? (
        notes.data.map((note) =>
          canEdit ? (
            <EditableNote
              key={note.id}
              note={note}
              onSave={(dto) => notes.update.mutate({ noteId: note.id, dto })}
              onDelete={() => notes.remove.mutate(note.id)}
            />
          ) : (
            <div key={note.id} className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">{note.title}</p>
              {note.body && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {note.body}
                </p>
              )}
            </div>
          ),
        )
      ) : (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const title = newTitle.trim();
            if (!title) return;
            notes.add.mutate({ title, body: "" });
            setNewTitle("");
          }}
        >
          <Input
            aria-label="New note title"
            placeholder="New note title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!newTitle.trim()}>
            <Plus data-icon="inline-start" />
            Add note
          </Button>
        </form>
      )}
    </section>
  );
}

function EditableNote({
  note,
  onSave,
  onDelete,
}: {
  note: NoteDto;
  onSave: (dto: { title?: string; body?: string }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);

  const saveTitle = () => {
    const trimmed = title.trim();
    if (!trimmed) return setTitle(note.title);
    if (trimmed !== note.title) onSave({ title: trimmed });
  };
  const saveBody = () => {
    if (body !== note.body) onSave({ body });
  };

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-2">
      <div className="flex items-center gap-1">
        <Input
          aria-label="Note title"
          className="h-8 border-none bg-transparent px-1 font-medium shadow-none focus-visible:ring-0"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete note ${note.title}`}
          onClick={() => {
            if (window.confirm(`Delete the note “${note.title}”?`)) onDelete();
          }}
        >
          <Trash2 />
        </Button>
      </div>
      <Textarea
        aria-label={`${note.title} text`}
        placeholder="Write something…"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={saveBody}
      />
    </div>
  );
}
