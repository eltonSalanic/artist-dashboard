"use client";

import { useState } from "react";
import { BellRing, Trash2 } from "lucide-react";
import { usePermissions } from "@/features/auth/permissions";
import {
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useUpdateReminder,
} from "@/features/planning/use-reminders";
import {
  formatDateTime,
  fromLocalInputValue,
} from "@/features/planning/planning-bits";
import { useDetailParams } from "@/features/planning/use-detail-params";
import type { ReminderDto } from "@/features/planning/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function RemindersWidget({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const reminders = useReminders(boardId);

  if (reminders.isPending) return <Skeleton className="h-full min-h-24" />;

  const items = (reminders.data ?? []).filter((r) => !r.done);
  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BellRing />
          </EmptyMedia>
          <EmptyTitle>No reminders</EmptyTitle>
          <EmptyDescription>
            {can("reminder.manage")
              ? "Add one from the expanded view."
              : "Nothing to remember right now."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((reminder) => (
        <ReminderRow key={reminder.id} boardId={boardId} reminder={reminder} />
      ))}
    </ul>
  );
}

export function RemindersWidgetExpanded({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const reminders = useReminders(boardId);
  const canManage = can("reminder.manage");

  return (
    <div className="flex flex-col gap-4">
      {canManage && <ReminderForm boardId={boardId} />}
      {reminders.isPending ? (
        <Skeleton className="h-40" />
      ) : (reminders.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No reminders yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {(reminders.data ?? []).map((reminder) => (
            <ReminderRow
              key={reminder.id}
              boardId={boardId}
              reminder={reminder}
              deletable={canManage}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReminderRow({
  boardId,
  reminder,
  deletable,
}: {
  boardId: string;
  reminder: ReminderDto;
  deletable?: boolean;
}) {
  const { can } = usePermissions();
  const { open } = useDetailParams();
  const updateReminder = useUpdateReminder(boardId);
  const deleteReminder = useDeleteReminder(boardId);
  const overdue =
    !reminder.done &&
    reminder.remindAt !== null &&
    new Date(reminder.remindAt) < new Date();

  return (
    <li className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50">
      <Checkbox
        checked={reminder.done}
        aria-label={`Mark ${reminder.title} done`}
        disabled={!can("reminder.manage")}
        onCheckedChange={(checked) =>
          updateReminder.mutate({
            reminderId: reminder.id,
            dto: { done: checked === true },
          })
        }
      />
      <button
        type="button"
        className={`min-w-0 flex-1 truncate text-left text-sm ${reminder.done ? "text-muted-foreground line-through" : ""}`}
        onClick={() => open("reminder", reminder.id)}
      >
        {reminder.title}
      </button>
      {reminder.remindAt && (
        <span
          className={`shrink-0 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}
        >
          {formatDateTime(reminder.remindAt)}
        </span>
      )}
      {deletable && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${reminder.title}`}
          onClick={() => deleteReminder.mutate(reminder.id)}
        >
          <Trash2 />
        </Button>
      )}
    </li>
  );
}

function ReminderForm({ boardId }: { boardId: string }) {
  const createReminder = useCreateReminder(boardId);
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        createReminder.mutate({
          title: title.trim(),
          remindAt: remindAt ? fromLocalInputValue(remindAt) : null,
        });
        setTitle("");
        setRemindAt("");
      }}
    >
      <Input
        aria-label="New reminder"
        placeholder="Heads up for the band…"
        className="min-w-40 flex-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <DateTimePicker
        aria-label="Remind at"
        mode="datetime"
        placeholder="Any time"
        className="w-52"
        value={remindAt}
        onChange={setRemindAt}
      />
      <Button type="submit" disabled={!title.trim()}>
        Add
      </Button>
    </form>
  );
}
