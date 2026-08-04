import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";

export const metadata: Metadata = {
  title: "Your band isn't a group chat",
  description:
    "A shared board for bands and artists. Put a name and a date on every job, keep shows and rehearsals on one calendar, and see what everyone's actually done.",
};

export default function Page() {
  return <LandingPage />;
}
