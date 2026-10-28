"use client";

import { useEffect } from "react";
import "./globals.css";
import { reportError } from "@/lib/report-error";

// Last resort: replaces the root layout, so it can't rely on providers or
// components that need them. Kept to plain markup.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => reportError(error, { boundary: "global" }), [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center font-sans antialiased">
        <title>Something went wrong · Band Wall</title>
        <h1 className="text-lg font-medium">Band Wall hit a problem</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Something broke while loading the app. Try again, or reload the page.
        </p>
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            onClick={() => unstable_retry()}
          >
            Try again
          </button>
          <button
            className="rounded-lg px-3 py-1.5 text-sm font-medium"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
