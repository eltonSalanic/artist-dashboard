import type { Metadata } from "next";
import { HomePage } from "@/features/home/home-page";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function Page() {
  return <HomePage />;
}
