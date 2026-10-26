"use client";

import { useState } from "react";
import { usePermissions } from "@artist/api-client";
import { ArchivedBanner } from "@/features/archive/archived-banner";
import { ItemActions } from "@/features/archive/item-actions";
import {
  useDeleteReminder,
  useReminder,
  useUpdateReminder,
} from "@artist/api-client";
import { useDetailParams } from "./use-detail-params";
import {
  formatDateTime,
  fromLocalInputValue,
  toLocalInputValue,
} from "./planning-bits";
import type { ReminderDto } from "@artist/api-client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemLinks } from "@/features/links/item-links";
import { ItemNotes } from "@/features/notes/item-notes";

export function ReminderDetailModal({ boardId }: { boardId: string }) {
  const { get, close } = useDetailParams();
  const reminderId = get("reminder");

  return (
    <Dialog
      open={!!reminderId}
      onOpenChange={(open) => !open && close("reminder")}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {reminderId && (
          <ReminderDetail
            key={reminderId}
            boardId={boardId}
            reminderId={reminderId}
            onClose={() => close("reminder")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReminderDetail({
  boardId,
  reminderId,
  onClose,
}: {
  boardId: string;
  reminderId: string;
  onClose: () => void;
}) {
  const reminder = useReminder(boardId, reminderId);

  if (reminder.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="sr-only">Loading reminder</DialogTitle>
        </DialogHeader>
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (reminder.isError || !reminder.data) {
    return (
      <DialogHeader>
        <DialogTitle>Reminder not found</DialogTitle>
        <DialogDescription>
          It may have been deleted by an admin.
        </DialogDescription>
      </DialogHeader>
    );
  }

  return (
    <ReminderDetailBody
      boardId={boardId}
      data={reminder.data}
      onClose={onClose}
    />
  );
}

function ReminderDetailBody({
  boardId,
  data,
  onClose,
}: {
  boardId: string;
  data: ReminderDto;
  onClose: () => void;
}) {
  const { can } = usePermissions();
  const updateReminder = useUpdateReminder(boardId);
  const deleteReminder = useDeleteReminder(boardId);

  const [title, setTitle] = useState(data.title);
  const canManage = can("reminder.manage");

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== data.title) {
      updateReminder.mutate({ reminderId: data.id, dto: { title: trimmed } });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ArchivedBanner archivedAt={data.archivedAt} />
      <DialogHeader>
        {canManage ? (
          <Input
            aria-label="Reminder title"
            className="border-none pr-8 text-lg font-semibold shadow-none focus-visible:ring-0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
          />
        ) : (
          <DialogTitle>{data.title}</DialogTitle>
        )}
        <DialogDescription>
          {data.remindAt
            ? `Reminder · ${formatDateTime(data.remindAt)}`
            : "Reminder · no time set"}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="reminder-at">Remind at</FieldLabel>
          {canManage ? (
            <DateTimePicker
              id="reminder-at"
              mode="datetime"
              placeholder="Any time"
              value={data.remindAt ? toLocalInputValue(data.remindAt) : ""}
              onChange={(value) =>
                updateReminder.mutate({
                  reminderId: data.id,
                  dto: { remindAt: value ? fromLocalInputValue(value) : null },
                })
              }
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {data.remindAt ? formatDateTime(data.remindAt) : "Any time"}
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={data.done}
              disabled={!canManage}
              onCheckedChange={(checked) =>
                updateReminder.mutate({
                  reminderId: data.id,
                  dto: { done: checked === true },
                })
              }
            />
            {data.done ? "Done" : "Open"}
          </label>
        </Field>
      </div>

      <ItemNotes
        boardId={boardId}
        kind="REMINDER"
        parentId={data.id}
        canEdit={canManage}
      />

      <ItemLinks boardId={boardId} kind="REMINDER" parentId={data.id} />

      {canManage && (
        <>
          <Separator />
          <ItemActions
            boardId={boardId}
            kind="REMINDER"
            id={data.id}
            itemLabel="reminder"
            archivedAt={data.archivedAt}
            deletePending={deleteReminder.isPending}
            onDelete={() =>
              deleteReminder.mutate(data.id, { onSuccess: onClose })
            }
            onDone={onClose}
          />
        </>
      )}
    </div>
  );
}
