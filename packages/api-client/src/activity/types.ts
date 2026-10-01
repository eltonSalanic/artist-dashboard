import type { ActivityType } from "@artist/shared";

export interface ActivityItemDto {
  id: string;
  type: ActivityType;
  /** Null once the actor's account is gone. */
  actor: { id: string; displayName: string; avatarUrl: string | null } | null;
  /** Denormalized snapshot written when the event happened. */
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityPage {
  items: ActivityItemDto[];
  nextCursor: string | null;
}
