import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-medium">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium underline underline-offset-4"
      >
        Go to your dashboard
      </Link>
    </main>
  );
}
