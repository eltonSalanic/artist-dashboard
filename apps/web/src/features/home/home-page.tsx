"use client";

import { Suspense } from "react";
import { useMe } from "@/lib/use-me";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { TaskDetailModal } from "@/features/tasks/task-detail-modal";
import { GoalDetailModal } from "@/features/planning/goal-detail-modal";
import { EventDetailModal } from "@/features/planning/event-detail-modal";
import { ReminderDetailModal } from "@/features/planning/reminder-detail-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SetupChecklist } from "@/features/onboarding/setup-checklist";

export function HomePage() {
  const me = useMe(true);
  const boardId = me.data?.board?.id;
  const isOwner = me.data?.boards.find((b) => b.id === boardId)?.isOwner ?? false;

  if (!boardId) return <Skeleton className="m-6 h-64" />;

  return (
    <Suspense>
      {isOwner && <SetupChecklist key={boardId} boardId={boardId} />}
      <DashboardPage boardId={boardId} />
      <TaskDetailModal boardId={boardId} />
      <GoalDetailModal boardId={boardId} />
      <EventDetailModal boardId={boardId} />
      <ReminderDetailModal boardId={boardId} />
    </Suspense>
  );
}
