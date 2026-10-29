"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";
import { reportError } from "@/lib/report-error";

// Catches a render crash in any signed-in page so the header and the rest of
// the app stay usable, instead of Next's bare default error screen.
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => reportError(error, { boundary: "app" }), [error]);

  return (
    <ErrorState
      title="This page hit a problem"
      message="Something broke while showing this page. Try again, and if it keeps happening, reload."
      onRetry={unstable_retry}
    />
  );
}
