"use client";

import { Suspense } from "react";
import { useMe } from "@/features/auth/use-me";
import { TasksTable } from "@/features/tasks/tasks-table";
import { TaskDetailModal } from "@/features/tasks/task-detail-modal";
import { Skeleton } from "@/components/ui/skeleton";

export function HomePage() {
  const me = useMe(true);
  const boardId = me.data?.board?.id;

  if (!boardId) return <Skeleton className="m-6 h-64" />;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold tracking-tight">To-Do&apos;s</h1>
      <Suspense>
        <TasksTable boardId={boardId} />
        <TaskDetailModal boardId={boardId} />
      </Suspense>
    </main>
  );
}
