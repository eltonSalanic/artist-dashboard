import type { Metadata } from "next";
import { ArchivePage } from "@/features/archive/archive-page";

export const metadata: Metadata = {
  title: "Archive",
  description:
    "Everything your band has archived off the dashboard — finished tasks, goals, shows, meetings, rehearsals and reminders, ready to restore.",
};

export default function Page() {
  return <ArchivePage />;
}
