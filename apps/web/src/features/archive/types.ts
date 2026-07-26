import type { ArchiveKind, EventType, GoalPeriod } from "@artist/shared";

export interface ArchiveItemDto {
  kind: ArchiveKind;
  id: string;
  title: string;
  archivedAt: string;
  /** The date the item was originally pinned to; null for undated items. */
  date: string | null;
  event?: { type: EventType; location: string | null };
  task?: { statusName: string; statusColor: string; isDone: boolean };
  goal?: { period: GoalPeriod; completed: boolean };
}
