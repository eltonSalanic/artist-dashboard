"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** react-grid-layout measures the DOM directly, so mount it client-side only —
 *  same treatment as the real dashboard grid. */
export const BoardDemo = dynamic(
  () => import("./board-demo-inner").then((m) => m.BoardDemoInner),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[32px] border border-foreground/10 bg-card/40 p-4">
        <Skeleton className="h-[392px] w-full rounded-2xl" />
      </div>
    ),
  },
);
