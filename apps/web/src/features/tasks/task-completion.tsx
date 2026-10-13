"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { useUpdateTask, type TaskDto } from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ChangingTask = Pick<
  TaskDto,
  "id" | "title" | "status" | "openSubtaskCount"
>;

/**
 * Changing a task's status, behind a confirmation when it completes subtasks.
 *
 * Moving a task into a done status finishes its open subtasks on the server —
 * there is no "this task only", on purpose: a task is not done while its
 * subtasks are not, the same rule as goals. So when there are any, the
 * confirmation says how many go with it before it asks. Every other change
 * (between open statuses, out of done, a task with nothing open under it) goes
 * straight through.
 *
 * Returns the handler for a status select and the dialog to render beside it.
 */
export function useTaskStatusChange(boardId: string) {
  const updateTask = useUpdateTask(boardId);
  const [asking, setAsking] = useState<{
    task: ChangingTask;
    statusId: string;
  } | null>(null);
  // Kept after closing, so the copy does not blank while the dialog animates out.
  const [shown, setShown] = useState<ChangingTask | null>(null);

  const changeStatus = (
    task: ChangingTask,
    statusId: string,
    statuses: { id: string; isDone: boolean }[],
  ) => {
    const finishing =
      !task.status.isDone &&
      statuses.find((status) => status.id === statusId)?.isDone === true;
    if (!finishing || task.openSubtaskCount === 0) {
      updateTask.mutate({ taskId: task.id, dto: { statusId } });
      return;
    }
    setShown(task);
    setAsking({ task, statusId });
  };

  const confirm = () => {
    if (!asking) return;
    updateTask.mutate(
      { taskId: asking.task.id, dto: { statusId: asking.statusId } },
      { onSuccess: () => setAsking(null) },
    );
  };

  const open = shown?.openSubtaskCount ?? 0;
  const noun = open === 1 ? "subtask" : "subtasks";

  const dialog = (
    <Dialog
      open={asking !== null}
      onOpenChange={(next) => !next && setAsking(null)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="size-4 shrink-0 text-muted-foreground" />
            Complete this task?
          </DialogTitle>
          <DialogDescription>
            <strong>{shown?.title}</strong> still has {open} open {noun}.
            Completing it marks {open === 1 ? "it" : "them"} done too.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={updateTask.isPending}
            onClick={() => setAsking(null)}
          >
            Cancel
          </Button>
          <Button disabled={updateTask.isPending} onClick={confirm}>
            Complete task and {open} {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { changeStatus, dialog };
}
