"use client";

import { LandingHeader } from "@/features/landing/landing-header";
import { Hero } from "@/features/landing/hero";
import { IntroSection } from "@/features/landing/intro-section";
import { WidgetShowcase } from "@/features/landing/widget-showcase";
import { FeaturesSection } from "@/features/landing/features-section";
import { CtaSection } from "@/features/landing/cta-section";
import { LandingFooter } from "@/features/landing/landing-footer";

export function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <IntroSection />
        <WidgetShowcase />
        <FeaturesSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
