import type { Metadata } from "next";
import { BandLive } from "@/features/onboarding/band-live";

export const metadata: Metadata = {
  title: "You're live",
};

export default function Page() {
  return <BandLive />;
}
