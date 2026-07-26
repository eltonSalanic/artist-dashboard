"use client";

import { useMemo, useState } from "react";
import type { EventType } from "@artist/shared";
import { CalendarPlus, MapPin } from "lucide-react";
import { usePermissions } from "@/features/auth/permissions";
import { useCreateEvent, useEvents } from "@/features/planning/use-events";
import { useDetailParams } from "@/features/planning/use-detail-params";
import {
  eventTypeIcon,
  eventTypeLabel,
  formatDateTime,
  fromLocalInputValue,
} from "@/features/planning/planning-bits";
import type { EventDto } from "@/features/planning/types";
import { Button } from "@/components/ui/button";
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

/**
 * SHOWS / NEXT_REHEARSALS / NEXT_MEETINGS are the same widget over a
 * different `Event.type`, so the registry entries share this factory.
 */
export function makeEventsWidget(type: EventType) {
  function Collapsed({ boardId }: { boardId: string }) {
    const { can } = usePermissions();
    const { open } = useDetailParams();
    // Upcoming only — recompute per mount, not per render, so the query key is stable.
    const from = useMemo(() => new Date().toISOString(), []);
    const events = useEvents(boardId, { type, from, limit: 20 });
    const Icon = eventTypeIcon[type];

    if (events.isPending) return <Skeleton className="h-full min-h-24" />;

    const items = events.data ?? [];
    if (items.length === 0) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon />
            </EmptyMedia>
            <EmptyTitle>Nothing coming up</EmptyTitle>
            <EmptyDescription>
              {can("event.manage")
                ? "Add one from the expanded view."
                : `No ${eventTypeLabel[type].toLowerCase()}s scheduled.`}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <ul className="flex flex-col divide-y divide-border/60">
        {items.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              className="flex w-full flex-col gap-0.5 px-1.5 py-2 text-left hover:bg-accent/50"
              onClick={() => open("event", event.id)}
            >
              <span className="truncate text-sm">{event.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {formatDateTime(event.startsAt)}
                {event.location && (
                  <span className="flex min-w-0 items-center gap-1">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function Expanded({ boardId }: { boardId: string }) {
    const { can } = usePermissions();
    const events = useEvents(boardId, { type });
    const canManage = can("event.manage");

    return (
      <div className="flex flex-col gap-4">
        {canManage && <EventForm boardId={boardId} type={type} />}
        {events.isPending ? (
          <Skeleton className="h-40" />
        ) : (events.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {eventTypeLabel[type].toLowerCase()}s yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {(events.data ?? []).map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  Collapsed.displayName = `${type}Widget`;
  Expanded.displayName = `${type}WidgetExpanded`;
  return { Collapsed, Expanded };
}

function EventRow({ event }: { event: EventDto }) {
  const { open } = useDetailParams();
  const past = new Date(event.startsAt) < new Date();

  return (
    <li className="flex items-center gap-2 py-2">
      <button
        type="button"
        className={`min-w-0 flex-1 truncate text-left text-sm ${past ? "text-muted-foreground" : ""}`}
        onClick={() => open("event", event.id)}
      >
        {event.title}
      </button>
      {event.location && (
        <span className="hidden max-w-40 shrink-0 truncate text-xs text-muted-foreground sm:block">
          {event.location}
        </span>
      )}
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatDateTime(event.startsAt)}
      </span>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        {event.taskCount} {event.taskCount === 1 ? "task" : "tasks"}
      </span>
    </li>
  );
}

function EventForm({ boardId, type }: { boardId: string; type: EventType }) {
  const createEvent = useCreateEvent(boardId);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !startsAt) return;
        createEvent.mutate({
          type,
          title: title.trim(),
          startsAt: fromLocalInputValue(startsAt),
          location: location.trim() || undefined,
        });
        setTitle("");
        setStartsAt("");
        setLocation("");
      }}
    >
      <Input
        aria-label={`New ${eventTypeLabel[type].toLowerCase()} title`}
        placeholder={`New ${eventTypeLabel[type].toLowerCase()}…`}
        className="min-w-40 flex-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <DateTimePicker
        aria-label="Starts at"
        mode="datetime"
        placeholder="Starts at"
        className="w-52"
        value={startsAt}
        onChange={setStartsAt}
      />
      <Input
        aria-label="Location"
        placeholder="Location"
        className="w-40"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <Button type="submit" disabled={!title.trim() || !startsAt}>
        <CalendarPlus data-icon="inline-start" />
        Add
      </Button>
    </form>
  );
}
