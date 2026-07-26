import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";

export const metadata: Metadata = {
  title: "Run the business side of your band, together",
  description:
    "A shared dashboard for bands and artists — tasks, goals, shows, and rehearsals in one place, so everyone knows what's next.",
};

export default function Page() {
  return <LandingPage />;
}
