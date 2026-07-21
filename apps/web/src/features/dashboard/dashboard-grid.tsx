"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** react-grid-layout measures the DOM directly — mount client-side only. */
export const DashboardGrid = dynamic(
  () => import("./dashboard-grid-inner").then((m) => m.DashboardGrid),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);
