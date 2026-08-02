import type { ComponentType } from "react";
import {
  Activity,
  Archive,
  AtSign,
  CalendarDays,
  Target,
  Ticket,
} from "lucide-react";
import { SectionHeading } from "@/features/landing/section-heading";

type Accent = "coral" | "lilac" | "lime" | "ink";

const FEATURES: {
  icon: ComponentType<{ className?: string }>;
  accent: Accent;
  title: string;
  body: string;
}[] = [
  {
    icon: CalendarDays,
    accent: "lilac",
    title: "Calendar View",
    body: "Shows, rehearsals, meetings and every due date on a calendar. Filter it down to what you actually care about, which is rarely all of it.",
  },
  {
    icon: Ticket,
    accent: "coral",
    title: "Every task knows its purpose",
    body: "Attach tasks to shows, meetings and goals, so “why are we doing this” has an answer that isn't vibes.",
  },
  {
    icon: AtSign,
    accent: "lime",
    title: "Talk it out on the task",
    body: "Comments, @mentions and file drops sit on the thing they're about. The setlist lives on the show, not four hundred messages up.",
  },
  {
    icon: Archive,
    accent: "ink",
    title: "See what you've pulled off",
    body: "Clear finished work off the board without deleting it. One list, sorted by year, for the next time someone swears the band never does anything.",
  },
  {
    icon: Activity,
    accent: "lilac",
    title: "Who did what, without asking",
    body: "A running feed of every change that counts, who took the task, who finished it, who finally uploaded the contract.",
  },
  {
    icon: Target,
    accent: "coral",
    title: "Goals, big and small",
    body: "Set the year, the month, the day, then pin the one thing to nail this week, so “we should really record something” doesn't stay a group chat idea forever.",
  },
];

const ACCENT: Record<Accent, string> = {
  coral: "bg-coral text-coral-foreground",
  lilac: "bg-lilac text-lilac-foreground",
  lime: "bg-lime text-lime-foreground",
  ink: "bg-ink text-ink-foreground",
};

export function FeaturesSection() {
  return (
    <section className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="The offstage stuff"
          title="Your one tool to get your band shit together"
          lede="Planning, follow-through, and receipts for both."
          align="center"
          className="mx-auto"
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col rounded-[24px] bg-card p-6 shadow-[0_1px_2px_rgba(20,16,10,0.04)] ring-1 ring-foreground/10 transition-shadow hover:shadow-[0_12px_30px_-14px_rgba(20,16,10,0.28)]"
            >
              <span
                className={`flex size-10 items-center justify-center rounded-2xl shadow-sm ${ACCENT[feature.accent]}`}
              >
                <feature.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-heading text-lg font-bold tracking-tight">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground text-pretty">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
