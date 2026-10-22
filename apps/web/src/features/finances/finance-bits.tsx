"use client";

import { formatMoney, type FinanceMemberRef } from "@artist/shared";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Today on the local calendar, as the `YYYY-MM-DD` the API takes. */
export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A `YYYY-MM-DD` the way people read it, without a timezone shifting the day. */
export function formatDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** `2026-10` → `Oct 2026` */
export function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export const PERIODS = [
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const;
export type Period = (typeof PERIODS)[number]["key"];

export function periodRange(period: Period, now = new Date()) {
  const today = todayISO(now);
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return {};
}

/** Money with its sign coloured: green in, red out, muted at zero. */
export function Amount({
  cents,
  currency,
  signed = false,
  className,
}: {
  cents: number;
  currency: string;
  /** Show a leading + on positive amounts. */
  signed?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        cents > 0 && "text-emerald-700 dark:text-emerald-400",
        cents < 0 && "text-red-700 dark:text-red-400",
        cents === 0 && "text-muted-foreground",
        className,
      )}
    >
      {signed && cents > 0 ? "+" : ""}
      {formatMoney(cents, currency)}
    </span>
  );
}

export function memberNamer(members: FinanceMemberRef[] | undefined) {
  const byId = new Map((members ?? []).map((m) => [m.id, m.displayName]));
  return (userId: string | null) =>
    userId === null ? "Band fund" : (byId.get(userId) ?? "Former member");
}

/** A labelled list of options, the shape every select on these screens takes. */
export function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  size,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(v as string)}
      items={options}
    >
      <SelectTrigger id={id} size={size} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Sentinel for "nobody" in a select, which can't hold an empty value. */
export const NONE = "__none__";
