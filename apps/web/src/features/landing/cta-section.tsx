"use client";

import { Button } from "@/components/ui/button";

/**
 * The finale: one big coral bento card that restates the pitch and repeats the
 * two auth buttons (still not wired up). The last thing on the page should be
 * the easiest thing to act on.
 */
export function CtaSection() {
  return (
    <section className="px-6 pt-4 pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-coral px-6 py-20 text-center text-coral-foreground shadow-[0_1px_2px_rgba(20,16,10,0.04)] ring-1 ring-foreground/10 md:py-24">
        {/* Soft interior light, so the flat coral has some depth. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 opacity-60"
        >
          <div className="absolute -top-24 left-1/4 size-80 rounded-full bg-lilac/40 blur-3xl" />
          <div className="absolute -bottom-24 right-1/4 size-80 rounded-full bg-lime/30 blur-3xl" />
        </div>

        <div className="relative flex flex-col items-center">
          <h2 className="max-w-2xl font-heading text-3xl leading-[1.1] font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Lowkenuinely what are you waiting for?
          </h2>
          <p className="mt-4 max-w-lg text-base text-coral-foreground/85 text-pretty sm:text-lg">
            This tool is made with love to make your musician life easier, try it out!
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button className="h-11 rounded-full bg-coral-foreground px-6 text-base text-coral hover:bg-coral-foreground/90">
              Create account
            </Button>
            <Button className="h-11 rounded-full border border-coral-foreground/40 bg-transparent px-6 text-base text-coral-foreground hover:bg-coral-foreground/10">
              Log in
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
