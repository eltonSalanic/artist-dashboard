"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { useUpdateGoal, type GoalDto } from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CompletableGoal = Pick<GoalDto, "id" | "title" | "openTaskCount">;

/**
 * Ticking a goal off, behind a confirmation.
 *
 * Completing a goal finishes its open tasks on the server — there is no
 * "complete the goal only", on purpose: a goal is not done while its to-dos
 * are not. So the confirmation says how many tasks go with it before it asks.
 * Reopening a goal is harmless and goes straight through.
 *
 * Returns the setter for a checkbox and the dialog to render beside it.
 */
export function useGoalCompletion(boardId: string) {
  const updateGoal = useUpdateGoal(boardId);
  const [asking, setAsking] = useState<CompletableGoal | null>(null);
  // Kept after closing, so the copy does not blank while the dialog animates out.
  const [shown, setShown] = useState<CompletableGoal | null>(null);

  const setCompleted = (goal: CompletableGoal, completed: boolean) => {
    if (!completed) {
      updateGoal.mutate({ goalId: goal.id, dto: { completed: false } });
      return;
    }
    setShown(goal);
    setAsking(goal);
  };

  const confirm = () => {
    if (!asking) return;
    updateGoal.mutate(
      { goalId: asking.id, dto: { completed: true } },
      { onSuccess: () => setAsking(null) },
    );
  };

  const open = shown?.openTaskCount ?? 0;
  const noun = open === 1 ? "task" : "tasks";

  const dialog = (
    <Dialog
      open={asking !== null}
      onOpenChange={(next) => !next && setAsking(null)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-4 shrink-0 text-muted-foreground" />
            Complete this goal?
          </DialogTitle>
          <DialogDescription>
            {open > 0 ? (
              <>
                <strong>{shown?.title}</strong> still has {open} open {noun}.
                Completing the goal marks {open === 1 ? "it" : "them"} done too.
              </>
            ) : (
              <>
                <strong>{shown?.title}</strong> will be marked complete.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={updateGoal.isPending}
            onClick={() => setAsking(null)}
          >
            Cancel
          </Button>
          <Button disabled={updateGoal.isPending} onClick={confirm}>
            {open > 0 ? `Complete goal and ${open} ${noun}` : "Complete goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { setCompleted, dialog };
}
