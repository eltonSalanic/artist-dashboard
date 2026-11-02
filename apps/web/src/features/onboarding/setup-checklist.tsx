"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";
import { useBoard, useEvents, useInvites, useTasks } from "@artist/api-client";
import { cn } from "@/lib/utils";
import { dismissSetup, setupDismissed } from "./onboarding-state";

/**
 * A small card above a new band's dashboard: three first things to do. It
 * ticks itself off from the band's own data and goes away when all three are
 * done, or when the owner closes it. Owners only.
 */
export function SetupChecklist({ boardId }: { boardId: string }) {
  const [dismissed, setDismissed] = useState(true);
  const board = useBoard(boardId);
  const invites = useInvites(boardId);
  const tasks = useTasks(boardId);
  const events = useEvents(boardId, { limit: 1 });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser storage once per band
    setDismissed(setupDismissed(boardId));
  }, [boardId]);

  if (dismissed || !board.data || !invites.data || !tasks.data || !events.data) {
    return null;
  }

  const steps = [
    {
      title: "Invite your bandmates",
      done: board.data.members.length > 1 || invites.data.length > 0,
      href: "/settings#invite",
    },
    {
      title: "Add your next show",
      done: events.data.length > 0,
      href: "/calendar",
    },
    {
      title: "Add a task and assign it, from the Tasks card",
      done: tasks.data.length > 0,
      href: null,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section
      aria-label="Get set up"
      className="mx-4 mt-4 flex max-w-md flex-col gap-0.5 rounded-2xl border bg-card px-3 py-2 sm:mx-6"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
          Get set up · {doneCount} of {steps.length}
        </span>
        <button
          type="button"
          aria-label="Hide the setup list"
          onClick={() => {
            dismissSetup(boardId);
            setDismissed(true);
          }}
          className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-3" aria-hidden />
        </button>
      </div>
      {steps.map((step) => {
        const row = (
          <>
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full",
                step.done
                  ? "bg-primary text-primary-foreground"
                  : "border-[1.5px] border-muted-foreground",
              )}
            >
              {step.done && <Check className="size-2.5" />}
            </span>
            <span
              className={cn(
                "flex-1",
                step.done && "text-muted-foreground line-through",
              )}
            >
              {step.title}
            </span>
            {!step.done && step.href && (
              <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
            )}
          </>
        );
        return !step.done && step.href ? (
          <Link
            key={step.title}
            href={step.href}
            className="flex min-h-8 items-center gap-2 rounded-md text-sm hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {row}
          </Link>
        ) : (
          <div key={step.title} className="flex min-h-8 items-center gap-2 text-sm">
            <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
            {row}
          </div>
        );
      })}
    </section>
  );
}
