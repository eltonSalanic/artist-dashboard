"use client";

import { LandingHeader } from "@/features/landing/landing-header";
import { Hero } from "@/features/landing/hero";

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
      </main>
    </div>
  );
}
