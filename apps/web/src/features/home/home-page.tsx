"use client";

import { Suspense } from "react";
import { useMe } from "@/features/auth/use-me";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { TaskDetailModal } from "@/features/tasks/task-detail-modal";
import { Skeleton } from "@/components/ui/skeleton";

export function HomePage() {
  const me = useMe(true);
  const boardId = me.data?.board?.id;

  if (!boardId) return <Skeleton className="m-6 h-64" />;

  return (
    <Suspense>
      <DashboardPage boardId={boardId} />
      <TaskDetailModal boardId={boardId} />
    </Suspense>
  );
}
