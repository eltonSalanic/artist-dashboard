import type { Metadata } from "next";
import { CalendarPage } from "@/features/calendar/calendar-page";

export const metadata: Metadata = {
  title: "Calendar",
  description:
    "Shows, rehearsals, meetings, task due dates and goals for your band in one month view.",
};

export default function Page() {
  return <CalendarPage />;
}
