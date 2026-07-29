"use client";

import { Check } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionHeading } from "@/features/landing/section-heading";

const POINTS = [
  {
    title: "Create tasks and assign them to members",
    body: "Subtasks, checklists, priorities and due dates for tasks",
  },
  {
    title: "Get updates without asking",
    body: "Stay updated with status labels, message threads, and attachments",
  },
  {
    title: "Calendar View",
    body: "See upcoming due dates, shows, and more",
  },
];

export function IntroSection() {
  return (
    <section className="px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Nobody has to ask"
            title="Stop chasing your bandmates."
            lede="Put a name and a date on every job. Then stop being the one who remembers everything."
          />
          <ul className="mt-8 flex flex-col gap-4">
            {POINTS.map((point) => (
              <li key={point.title} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-lime text-lime-foreground">
                  <Check className="size-3.5" />
                </span>
                <div>
                  <p className="font-heading text-sm font-bold tracking-tight">
                    {point.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <AssignmentCard />
      </div>
    </section>
  );
}

/** Status colors borrowed from the brand accents, not the real board's palette. */
const STATUS = {
  done: { label: "Done", dot: "bg-lime" },
  doing: { label: "In progress", dot: "bg-coral" },
  todo: { label: "Not started", dot: "bg-foreground/25" },
} as const;

const ROWS: {
  who: string;
  task: string;
  status: keyof typeof STATUS;
  due: string;
}[] = [
  { who: "JD", task: "Confirm the load-in time", status: "todo", due: "Thu" },
  { who: "MK", task: "Pre-dent the SM58", status: "doing", due: "Fri" },
  {
    who: "AR",
    task: "Buy beer and pizza for rehearsal",
    status: "done",
    due: "Mon",
  },
  { who: "JD", task: "Restock the merch box", status: "todo", due: "Tue" },
];

/** A still frame of the answer to "who's doing that?". */
function AssignmentCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[36px] bg-lilac/20 blur-2xl"
      />
      <div className="rounded-[28px] bg-card p-6 shadow-[0_1px_2px_rgba(20,16,10,0.04)] ring-1 ring-foreground/10">
        <p className="font-heading text-lg font-bold tracking-tight">
          Who&apos;s on what
        </p>
        <p className="text-xs text-muted-foreground">
          Before the Los Angeles show
        </p>

        <div className="mt-5 flex flex-col gap-1">
          {ROWS.map((row) => (
            <div
              key={row.task}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-2"
            >
              <Avatar size="sm">
                <AvatarFallback>{row.who}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{row.task}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden
                    className={`size-1.5 rounded-full ${STATUS[row.status].dot}`}
                  />
                  {STATUS[row.status].label}
                </span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {row.due}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
