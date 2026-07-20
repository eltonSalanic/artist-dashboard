import type { Metadata } from "next";
import { CallbackPage } from "@/features/auth/callback-page";

export const metadata: Metadata = {
  title: "Signing you in",
};

export default function Page() {
  return <CallbackPage />;
}
