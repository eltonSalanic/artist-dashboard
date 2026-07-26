"use client";

import { LandingHeader } from "@/features/landing/landing-header";
import { Hero } from "@/features/landing/hero";
import { IntroSection } from "@/features/landing/intro-section";
import { WidgetShowcase } from "@/features/landing/widget-showcase";

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <IntroSection />
        <WidgetShowcase />
      </main>
    </div>
  );
}
