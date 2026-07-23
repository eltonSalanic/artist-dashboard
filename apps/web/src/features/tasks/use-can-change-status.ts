"use client";

import { useMe } from "@/features/auth/use-me";
import { usePermissions } from "@/features/auth/permissions";
import type { TaskAssigneeDto } from "./types";

/**
 * Members may only change the status of tasks they're assigned to; admins may
 * change any. Mirrors the API's enforcement in TasksService.update — the check
 * here just keeps the control from looking usable when it isn't.
 */
export function useCanChangeStatus() {
  const { can } = usePermissions();
  const me = useMe(true);
  const myId = me.data?.user.id;

  return (assignees: TaskAssigneeDto[]) => {
    if (!can("task.changeStatus")) return false;
    if (can("task.editFields")) return true; // admins may restatus anything
    return !!myId && assignees.some((a) => a.id === myId);
  };
}
