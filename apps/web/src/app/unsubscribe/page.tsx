import { Suspense } from "react";
import type { Metadata } from "next";
import { UnsubscribePage } from "@/features/notifications/unsubscribe-page";

export const metadata: Metadata = {
  title: "Unsubscribe",
  // Nothing here should ever be indexed — the URL carries a signed token.
  robots: { index: false, follow: false },
};

export default function Page() {
  // useSearchParams needs a Suspense boundary above it at build time.
  return (
    <Suspense>
      <UnsubscribePage />
    </Suspense>
  );
}
