"use client";

import { CalendarDays, CheckCircle2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FauxRow, MiniWidget } from "@/features/landing/mini-widget";

/**
 * Top of the page: the one-line pitch, the two calls to action, and a small,
 * tilted cluster of widgets that establishes the bento motif the rest of the
 * page pays off. The cluster is static here; the animated version lives further
 * down, so the hero stays calm.
 */
export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden px-6 pt-20 pb-16 md:pt-28 md:pb-24"
    >
      {/* Ambient wash — the three brand accents, blurred to atmosphere. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-coral/25 blur-3xl" />
        <div className="absolute -top-16 right-0 size-80 rounded-full bg-lilac/25 blur-3xl" />
        <div className="absolute top-40 left-1/3 size-72 rounded-full bg-lime/20 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col items-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-coral" />
            Made for working musicians
          </span>

          <h1 className="mt-5 font-heading text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
            Your band isn&apos;t a group chat.
          </h1>

          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Shows, rehearsals, setlists, and all your to-dos on one board
            the whole band can see. No more “what time&apos;s load-in?” texts
            the morning of.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button className="h-11 rounded-full bg-coral px-6 text-base text-coral-foreground hover:bg-coral/90">
              Create account
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="#demo" />}
              className="h-11 rounded-full px-6 text-base"
            >
              See it move
            </Button>
          </div>
        </div>

        {/* Decorative bento cluster — a still frame of the real thing. */}
        <div
          data-palette="playful"
          aria-hidden
          className="relative mx-auto hidden w-full max-w-md lg:block"
        >
          <div className="grid grid-cols-2 gap-4">
            <MiniWidget
              title="My Tasks"
              icon={CheckCircle2}
              color="c1"
              className="rotate-[-2deg]"
            >
              <FauxRow width="long" tone="solid" />
              <FauxRow width="mid" />
              <FauxRow width="full" />
            </MiniWidget>
            <MiniWidget
              title="Goals"
              icon={Target}
              color="c3"
              className="mt-6 rotate-[2deg]"
            >
              <FauxRow width="mid" tone="solid" />
              <FauxRow width="short" />
            </MiniWidget>
            <MiniWidget
              title="Shows"
              icon={CalendarDays}
              color="c2"
              className="col-span-2 -mt-2 rotate-[1deg]"
            >
              <div className="flex gap-2">
                <FauxRow width="mid" tone="solid" />
                <FauxRow width="short" />
              </div>
            </MiniWidget>
          </div>
        </div>
      </div>
    </section>
  );
}
