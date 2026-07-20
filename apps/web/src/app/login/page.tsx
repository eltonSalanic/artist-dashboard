import type { Metadata } from "next";
import { LoginPage } from "@/features/auth/login-page";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function Page() {
  return <LoginPage />;
}
