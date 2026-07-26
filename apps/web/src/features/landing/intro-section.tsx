"use client";

import { Check, Mail, UserPlus } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/features/landing/section-heading";

const POINTS = [
  {
    title: "Invite by email",
    body: "Bandmates join from a link in their inbox — no accounts to set up for them.",
  },
  {
    title: "One shared board",
    body: "Everyone works from the same tasks, shows, and goals. One source of truth.",
  },
  {
    title: "No more chasing",
    body: "Every task shows who owns it and when it's due, so nothing falls to the group chat.",
  },
];

export function IntroSection() {
  return (
    <section className="px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Everyone in the loop"
            title="Invite the band. Everyone sees what needs doing."
            lede="Add your bandmates and the whole group works from one board — no more midnight “who's booking the venue?” in the group chat."
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

        <InviteCard />
      </div>
    </section>
  );
}

/** A still frame of the invite flow: who's on the board, and adding one more. */
function InviteCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[36px] bg-lilac/20 blur-2xl"
      />
      <div className="rounded-[28px] bg-card p-6 shadow-[0_1px_2px_rgba(20,16,10,0.04)] ring-1 ring-foreground/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-lg font-bold tracking-tight">
              Neon Harbor
            </p>
            <p className="text-xs text-muted-foreground">4 members</p>
          </div>
          <AvatarGroup>
            {["JD", "MK", "AR"].map((initials) => (
              <Avatar key={initials} size="sm">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            ))}
            <AvatarGroupCount className="size-6 text-xs">+1</AvatarGroupCount>
          </AvatarGroup>
        </div>

        {/* Invite row — a still of the email → invite moment. */}
        <div className="mt-5 flex items-center gap-2 rounded-full border border-foreground/10 bg-background/60 py-1.5 pr-1.5 pl-3">
          <Mail className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            bass@neonharbor.band
          </span>
          <Button className="h-7 shrink-0 rounded-full bg-coral px-3 text-xs text-coral-foreground hover:bg-coral/90">
            <UserPlus data-icon="inline-start" />
            Invite
          </Button>
        </div>

        {/* Who's on what. */}
        <div className="mt-5 flex flex-col gap-1">
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
            Who&apos;s on what
          </p>
          {[
            { who: "JD", task: "Confirm the load-in time", due: "Thu" },
            { who: "MK", task: "Send the setlist to the venue", due: "Fri" },
            { who: "AR", task: "Book rehearsal room", due: "Mon" },
          ].map((row) => (
            <div
              key={row.task}
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5"
            >
              <Avatar size="sm">
                <AvatarFallback>{row.who}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">
                {row.task}
              </span>
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
