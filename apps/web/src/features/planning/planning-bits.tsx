"use client";

import type { EventType, GoalPeriod } from "@artist/shared";
import { CalendarDays, Mic2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const eventTypeLabel: Record<EventType, string> = {
  SHOW: "Show",
  MEETING: "Meeting",
  REHEARSAL: "Rehearsal",
};

export const eventTypeIcon: Record<
  EventType,
  React.ComponentType<{ className?: string }>
> = {
  SHOW: Mic2,
  MEETING: Users,
  REHEARSAL: CalendarDays,
};

export const goalPeriodLabel: Record<GoalPeriod, string> = {
  YEARLY: "Yearly",
  MONTHLY: "Monthly",
  DAILY: "Daily",
};

export function EventTypeBadge({ type }: { type: EventType }) {
  const Icon = eventTypeIcon[type];
  return (
    <Badge variant={type === "SHOW" ? "default" : "secondary"}>
      <Icon data-icon="inline-start" />
      {eventTypeLabel[type]}
    </Badge>
  );
}

/** "Mar 14, 8:00 PM" — the standard event/reminder stamp. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Mar 14" — date only, for goals and day cells. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** "8:00 PM" — time only, for calendar day cells. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Converts an ISO instant to the `datetime-local` input format in the
 * viewer's timezone (the input has no timezone of its own).
 */
export function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Inverse of `toLocalInputValue` — local wall time back to an ISO instant. */
export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}
