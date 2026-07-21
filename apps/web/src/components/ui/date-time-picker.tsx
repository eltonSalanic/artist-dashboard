"use client"

import * as React from "react"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * A mini-calendar date picker with a scrollable time reel beside it.
 *
 * The `value`/`onChange` strings match the native inputs this replaces:
 * `YYYY-MM-DD` in `date` mode, `YYYY-MM-DDTHH:mm` in `datetime` mode, and
 * `""` when nothing is set. Everything is local wall time — callers keep
 * owning the conversion to and from ISO instants.
 */
export type DateTimePickerProps = {
  mode?: "date" | "datetime"
  value: string
  onChange: (value: string) => void
  /** Minutes between rows on the time reel. */
  minuteStep?: number
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  id?: string
  className?: string
  "aria-label"?: string
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Reads a picker value as local wall time; `null` when unset or malformed. */
export function parseValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value)
  if (!match) return null
  const [, y, m, d, h, min] = match
  return new Date(+y, +m - 1, +d, +(h ?? 0), +(min ?? 0))
}

/** Inverse of `parseValue`. */
export function serialize(date: Date, mode: "date" | "datetime"): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  if (mode === "date") return day
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function formatTimeLabel(hours: number, minutes: number) {
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

/** The 42 cells of a month grid, including the adjacent-month spill. */
export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

/** Reel rows for the day, with the current off-step selection folded in. */
export function timeRows(step: number, selected: Date | null): number[] {
  const rows: number[] = []
  for (let m = 0; m < 24 * 60; m += step) rows.push(m)
  if (selected) {
    const exact = selected.getHours() * 60 + selected.getMinutes()
    if (!rows.includes(exact)) {
      rows.push(exact)
      rows.sort((a, b) => a - b)
    }
  }
  return rows
}

function DateTimePicker({
  mode = "date",
  value,
  onChange,
  minuteStep = 15,
  placeholder,
  disabled,
  clearable = true,
  id,
  className,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = React.useMemo(() => parseValue(value), [value])
  const today = React.useMemo(() => new Date(), [])

  const [month, setMonth] = React.useState(() =>
    startOfMonth(selected ?? today)
  )
  // Reopening always lands on the month you're actually looking at.
  const handleOpenChange = (next: boolean) => {
    if (next) setMonth(startOfMonth(parseValue(value) ?? new Date()))
    setOpen(next)
  }

  const days = React.useMemo(() => monthGrid(month), [month])
  const rows = React.useMemo(
    () => timeRows(minuteStep, selected),
    [minuteStep, selected]
  )
  const selectedMinutes = selected
    ? selected.getHours() * 60 + selected.getMinutes()
    : null

  const commit = (date: Date) => {
    onChange(serialize(date, mode))
    if (mode === "date") setOpen(false)
  }

  const pickDay = (day: Date) => {
    const next = new Date(day)
    if (mode === "datetime") {
      const base = selected ?? defaultTimeFor(new Date())
      next.setHours(base.getHours(), base.getMinutes(), 0, 0)
    }
    commit(next)
  }

  const pickTime = (minutes: number) => {
    const next = new Date(selected ?? today)
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    commit(next)
  }

  // Centre the reel on the selection each time the popover opens. Set
  // scrollTop directly — scrollIntoView would also scroll the page behind.
  const reelRef = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const target = node.querySelector<HTMLElement>("[data-selected=true]")
    node.scrollTop = target
      ? target.offsetTop - node.clientHeight / 2 + target.clientHeight / 2
      : 0
  }, [])

  const label = selected
    ? formatTrigger(selected, mode, today)
    : (placeholder ?? (mode === "date" ? "Pick a date" : "Pick a date & time"))

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-expanded:border-ring dark:bg-input/30 dark:hover:bg-input/50",
              !selected && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </button>
        }
      />
      <PopoverContent className="flex w-auto overflow-hidden p-0">
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="text-sm font-medium tabular-nums">
              {month.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRightIcon />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                aria-hidden
                className="pb-1 text-center text-[0.7rem] font-medium text-muted-foreground"
              >
                {day.slice(0, 2)}
              </div>
            ))}
            {days.map((day) => {
              const outside = day.getMonth() !== month.getMonth()
              const isSelected = selected != null && sameDay(day, selected)
              const isToday = sameDay(day, today)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={day.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  onClick={() => pickDay(day)}
                  className={cn(
                    "relative size-8 rounded-md text-sm tabular-nums transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    outside && "text-muted-foreground/50",
                    isSelected &&
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                    isToday &&
                      !isSelected &&
                      "font-semibold text-foreground after:absolute after:inset-x-0 after:bottom-1 after:mx-auto after:size-1 after:rounded-full after:bg-primary"
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => pickDay(new Date())}
            >
              Today
            </Button>
            {mode === "datetime" ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => commit(new Date())}
              >
                Now
              </Button>
            ) : null}
            <span className="flex-1" />
            {clearable && selected ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                Clear
              </Button>
            ) : null}
            {mode === "datetime" ? (
              <Button
                type="button"
                size="xs"
                onClick={() => setOpen(false)}
                disabled={!selected}
              >
                Done
              </Button>
            ) : null}
          </div>
        </div>

        {mode === "datetime" ? (
          <div className="flex w-28 flex-col border-l border-border">
            <div className="border-b border-border px-3 py-2 text-[0.7rem] font-medium text-muted-foreground">
              Time
            </div>
            <div
              ref={reelRef}
              role="listbox"
              aria-label="Time"
              className="flex-1 scrollbar-thin overflow-y-auto overscroll-contain p-1"
              style={{ maxHeight: 268 }}
            >
              {rows.map((minutes) => {
                const isSelected = minutes === selectedMinutes
                return (
                  <button
                    key={minutes}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    onClick={() => pickTime(minutes)}
                    className={cn(
                      "w-full rounded-md px-2 py-1 text-right text-sm tabular-nums transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      minutes % 60 === 0
                        ? "text-foreground"
                        : "text-muted-foreground",
                      isSelected &&
                        "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    {formatTimeLabel(Math.floor(minutes / 60), minutes % 60)}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** Picking a day before a time lands on the next round hour, not midnight. */
function defaultTimeFor(now: Date) {
  const next = new Date(now)
  next.setHours(now.getHours() + 1, 0, 0, 0)
  return next
}

function formatTrigger(date: Date, mode: "date" | "datetime", today: Date) {
  const day = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  })
  if (mode === "date") return day
  return `${day} · ${formatTimeLabel(date.getHours(), date.getMinutes())}`
}

export { DateTimePicker }
