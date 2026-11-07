"use client";

import {
  PAYBACK_LABELS,
  paybackStatus,
  type FinanceEntryDto,
} from "@artist/shared";
import { cn } from "@/lib/utils";

/** "Owed back" or "Paid back" on an expense a member paid out of pocket. */
export function PaybackBadge({
  entry,
  className,
}: {
  entry: FinanceEntryDto;
  className?: string;
}) {
  const status = paybackStatus(entry);
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "paid"
          ? "bg-emerald-700/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400"
          : "bg-red-700/10 text-red-700 dark:bg-red-400/10 dark:text-red-400",
        className,
      )}
    >
      {PAYBACK_LABELS[status]}
    </span>
  );
}
