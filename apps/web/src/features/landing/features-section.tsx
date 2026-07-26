import type { ComponentType } from "react";
import {
  Activity,
  AtSign,
  Bell,
  CalendarDays,
  ListChecks,
  Target,
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
    icon: ListChecks,
    accent: "coral",
    title: "Tasks that don't slip",
    body: "Statuses, priorities, due dates, subtasks, and checklists. Assign anyone; each person restatuses their own.",
  },
  {
    icon: CalendarDays,
    accent: "lilac",
    title: "One calendar for the band",
    body: "Shows, rehearsals, and meetings on a shared month view, with filters for the kind you're after.",
  },
  {
    icon: Target,
    accent: "lime",
    title: "Goals, and what to focus on",
    body: "Set goals by year, month, and day — then pin the one thing that matters this week.",
  },
  {
    icon: Bell,
    accent: "ink",
    title: "Reminders for the rest",
    body: "The things that aren't quite tasks — renewals, deadlines, a bandmate's birthday — surfaced before they pass.",
  },
  {
    icon: AtSign,
    accent: "coral",
    title: "Talk it out in place",
    body: "Comments with @mentions and file attachments, right on the task — not scattered across three apps.",
  },
  {
    icon: Activity,
    accent: "lilac",
    title: "Everything's on the record",
    body: "A boardwide activity feed logs every meaningful change, so you can always see what moved and who moved it.",
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
          eyebrow="The whole business side"
          title="More than a pretty dashboard."
          lede="Everything the working side of a band needs — planning, follow-through, and a record of it all — in one shared place."
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
