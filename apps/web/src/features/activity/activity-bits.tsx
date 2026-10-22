import type { ComponentType } from "react";
import {
  CheckCircle2,
  FileUp,
  HandCoins,
  MessageSquare,
  Plus,
  RefreshCw,
  Target,
  UserMinus,
  UserPlus,
  Wallet,
} from "lucide-react";
import { activityText, type ActivityType } from "@artist/shared";
import type { ActivityItemDto } from "@artist/api-client";

interface Rendered {
  icon: ComponentType<{ className?: string }>;
  /** Human sentence, minus the actor's name (the caller prepends it). */
  text: string;
}

/** The icon per event type. The sentence is shared — see `activityText`. */
const icons: Record<ActivityType, ComponentType<{ className?: string }>> = {
  TASK_CREATED: Plus,
  TASK_COMPLETED: CheckCircle2,
  STATUS_CHANGED: RefreshCw,
  MEMBER_ASSIGNED: UserPlus,
  MEMBER_REMOVED: UserMinus,
  GOAL_COMPLETED: Target,
  FILE_UPLOADED: FileUp,
  COMMENT_ADDED: MessageSquare,
  FINANCE_ENTRY_ADDED: Wallet,
  SHOW_SETTLED: HandCoins,
  PAYOUT_RECORDED: HandCoins,
};

/**
 * Turns a feed row into an icon and a sentence, entirely from its denormalized
 * `meta` — the feed never joins back to live records, so an entry still reads
 * correctly after its subject is renamed or deleted.
 */
export function renderActivity(item: ActivityItemDto): Rendered {
  return {
    icon: icons[item.type] ?? RefreshCw,
    text: activityText(item),
  };
}

export { activityTaskId } from "@artist/shared";
