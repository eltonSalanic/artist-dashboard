"use client";

import { useState } from "react";
import { EventTypes, type EventType } from "@artist/shared";
import { usePermissions } from "@/features/auth/permissions";
import { ItemActions } from "@/features/archive/item-actions";
import { useTasks } from "@/features/tasks/use-tasks";
import { useDeleteEvent, useEvent, useUpdateEvent } from "./use-events";
import { useDetailParams } from "./use-detail-params";
import {
  EventTypeBadge,
  eventTypeLabel,
  formatDateTime,
  fromLocalInputValue,
  toLocalInputValue,
} from "./planning-bits";
import { LinkedTasks } from "./linked-tasks";
import type { EventDto } from "./types";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function EventDetailModal({ boardId }: { boardId: string }) {
  const { get, close } = useDetailParams();
  const eventId = get("event");

  return (
    <Dialog open={!!eventId} onOpenChange={(open) => !open && close("event")}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {eventId && (
          <EventDetail
            key={eventId}
            boardId={boardId}
            eventId={eventId}
            onClose={() => close("event")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventDetail({
  boardId,
  eventId,
  onClose,
}: {
  boardId: string;
  eventId: string;
  onClose: () => void;
}) {
  const event = useEvent(boardId, eventId);

  if (event.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="sr-only">Loading event</DialogTitle>
        </DialogHeader>
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (event.isError || !event.data) {
    return (
      <DialogHeader>
        <DialogTitle>Event not found</DialogTitle>
        <DialogDescription>
          It may have been deleted by an admin.
        </DialogDescription>
      </DialogHeader>
    );
  }

  return (
    <EventDetailBody boardId={boardId} data={event.data} onClose={onClose} />
  );
}

function EventDetailBody({
  boardId,
  data,
  onClose,
}: {
  boardId: string;
  data: EventDto;
  onClose: () => void;
}) {
  const { can } = usePermissions();
  const updateEvent = useUpdateEvent(boardId);
  const deleteEvent = useDeleteEvent(boardId);
  // An archived event keeps its tasks — showing them is the whole point of
  // looking one up in the archive.
  const tasks = useTasks(boardId, {
    eventId: data.id,
    includeArchived: data.archivedAt !== null,
  });

  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description ?? "");
  const [location, setLocation] = useState(data.location ?? "");
  const canManage = can("event.manage");

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== data.title) {
      updateEvent.mutate({ eventId: data.id, dto: { title: trimmed } });
    }
  };
  const saveDescription = () => {
    const value = description.trim() || null;
    if (value !== (data.description ?? null)) {
      updateEvent.mutate({ eventId: data.id, dto: { description: value } });
    }
  };
  const saveLocation = () => {
    const value = location.trim() || null;
    if (value !== (data.location ?? null)) {
      updateEvent.mutate({ eventId: data.id, dto: { location: value } });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        {canManage ? (
          <Input
            aria-label="Event title"
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
          {eventTypeLabel[data.type]} · {formatDateTime(data.startsAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="event-type">Type</FieldLabel>
          {canManage ? (
            <Select
              value={data.type}
              onValueChange={(v) =>
                v &&
                updateEvent.mutate({
                  eventId: data.id,
                  dto: { type: v as EventType },
                })
              }
              items={EventTypes.map((t) => ({
                value: t,
                label: eventTypeLabel[t],
              }))}
            >
              <SelectTrigger id="event-type" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {EventTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {eventTypeLabel[t]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <EventTypeBadge type={data.type} />
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="event-location">Location</FieldLabel>
          {canManage ? (
            <Input
              id="event-location"
              placeholder="Venue, address…"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={saveLocation}
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {data.location || "—"}
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="event-starts">Starts</FieldLabel>
          {canManage ? (
            <DateTimePicker
              id="event-starts"
              mode="datetime"
              clearable={false}
              value={toLocalInputValue(data.startsAt)}
              onChange={(value) =>
                value &&
                updateEvent.mutate({
                  eventId: data.id,
                  dto: { startsAt: fromLocalInputValue(value) },
                })
              }
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {formatDateTime(data.startsAt)}
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="event-ends">Ends</FieldLabel>
          {canManage ? (
            <DateTimePicker
              id="event-ends"
              mode="datetime"
              placeholder="No end time"
              value={data.endsAt ? toLocalInputValue(data.endsAt) : ""}
              onChange={(value) =>
                updateEvent.mutate({
                  eventId: data.id,
                  dto: { endsAt: value ? fromLocalInputValue(value) : null },
                })
              }
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {data.endsAt ? formatDateTime(data.endsAt) : "—"}
            </span>
          )}
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="event-description">Description</FieldLabel>
        {canManage ? (
          <Textarea
            id="event-description"
            placeholder="Load-in time, set length, notes…"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {data.description || "No description."}
          </p>
        )}
      </Field>

      <Separator />

      <LinkedTasks
        boardId={boardId}
        heading="Tasks for this event"
        tasks={tasks.data ?? []}
        isPending={tasks.isPending}
        link={{ eventId: data.id }}
      />

      {canManage && (
        <>
          <Separator />
          <ItemActions
            boardId={boardId}
            kind="EVENT"
            id={data.id}
            itemLabel={eventTypeLabel[data.type].toLowerCase()}
            archivedAt={data.archivedAt}
            liveTaskCount={data.taskCount}
            archivedTaskCount={data.archivedTaskCount ?? 0}
            linkedTaskCount={data.linkedTaskCount ?? 0}
            deletePending={deleteEvent.isPending}
            onDelete={(cascadeTasks) =>
              deleteEvent.mutate(
                { eventId: data.id, cascadeTasks },
                { onSuccess: onClose },
              )
            }
            onDone={onClose}
          />
        </>
      )}
    </div>
  );
}
