"use client";

import { useState } from "react";
import { GoalPeriods, type GoalPeriod } from "@artist/shared";
import { usePermissions } from "@artist/api-client";
import { ArchivedBanner } from "@/features/archive/archived-banner";
import { ItemActions } from "@/features/archive/item-actions";
import { useTasks } from "@artist/api-client";
import { useDeleteGoal, useGoal, useUpdateGoal } from "@artist/api-client";
import { useGoalCompletion } from "./goal-completion";
import { useDetailParams } from "./use-detail-params";
import { formatDate, formatLocalDate, goalPeriodLabel } from "./planning-bits";
import { LinkedTasks } from "./linked-tasks";
import type { GoalDto } from "@artist/api-client";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemLinks } from "@/features/links/item-links";
import { ItemNotes } from "@/features/notes/item-notes";
import { BandTag } from "@/features/shell/band-tag";

export function GoalDetailModal({ boardId }: { boardId: string }) {
  const { get, close } = useDetailParams();
  const goalId = get("goal");

  return (
    <Dialog open={!!goalId} onOpenChange={(open) => !open && close("goal")}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {goalId && (
          <GoalDetail
            key={goalId}
            boardId={boardId}
            goalId={goalId}
            onClose={() => close("goal")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GoalDetail({
  boardId,
  goalId,
  onClose,
}: {
  boardId: string;
  goalId: string;
  onClose: () => void;
}) {
  const goal = useGoal(boardId, goalId);

  if (goal.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="sr-only">Loading goal</DialogTitle>
        </DialogHeader>
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (goal.isError || !goal.data) {
    return (
      <DialogHeader>
        <DialogTitle>Goal not found</DialogTitle>
        <DialogDescription>
          It may have been deleted by an admin.
        </DialogDescription>
      </DialogHeader>
    );
  }

  return (
    <GoalDetailBody boardId={boardId} data={goal.data} onClose={onClose} />
  );
}

function GoalDetailBody({
  boardId,
  data,
  onClose,
}: {
  boardId: string;
  data: GoalDto;
  onClose: () => void;
}) {
  const { can } = usePermissions();
  const updateGoal = useUpdateGoal(boardId);
  const completion = useGoalCompletion(boardId);
  const deleteGoal = useDeleteGoal(boardId);
  // An archived goal keeps its tasks — showing them is the whole point of
  // looking one up in the archive.
  const tasks = useTasks(boardId, {
    goalId: data.id,
    includeArchived: data.archivedAt !== null,
  });

  const [title, setTitle] = useState(data.title);
  const canManage = can("goal.manage");
  const completed = data.completedAt !== null;

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== data.title) {
      updateGoal.mutate({ goalId: data.id, dto: { title: trimmed } });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <ArchivedBanner archivedAt={data.archivedAt} />
      <DialogHeader>
        <BandTag boardId={boardId} />
        {canManage ? (
          <Input
            aria-label="Goal title"
            className="border-none pr-8 text-lg font-semibold shadow-none focus-visible:ring-0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
          />
        ) : (
          <DialogTitle>{data.title}</DialogTitle>
        )}
        <DialogDescription>
          {goalPeriodLabel[data.period]} goal
          {completed
            ? ` · completed ${formatLocalDate(data.completedAt)}`
            : data.dueDate
              ? ` · due ${formatDate(data.dueDate)}`
              : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="goal-period">Period</FieldLabel>
          {canManage ? (
            <Select
              value={data.period}
              onValueChange={(v) =>
                v &&
                updateGoal.mutate({
                  goalId: data.id,
                  dto: { period: v as GoalPeriod },
                })
              }
              items={GoalPeriods.map((p) => ({
                value: p,
                label: goalPeriodLabel[p],
              }))}
            >
              <SelectTrigger id="goal-period" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {GoalPeriods.map((p) => (
                    <SelectItem key={p} value={p}>
                      {goalPeriodLabel[p]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline">{goalPeriodLabel[data.period]}</Badge>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="goal-due">Due date</FieldLabel>
          {canManage ? (
            <DateTimePicker
              id="goal-due"
              placeholder="No due date"
              value={data.dueDate ? data.dueDate.slice(0, 10) : ""}
              onChange={(value) =>
                updateGoal.mutate({
                  goalId: data.id,
                  dto: {
                    dueDate: value ? new Date(value).toISOString() : null,
                  },
                })
              }
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {formatDate(data.dueDate)}
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={completed}
              disabled={!canManage}
              onCheckedChange={(checked) =>
                completion.setCompleted(data, checked === true)
              }
            />
            {completion.dialog}
            {completed ? "Completed" : "In progress"}
          </label>
        </Field>
      </div>

      <ItemNotes
        boardId={boardId}
        kind="GOAL"
        parentId={data.id}
        canEdit={canManage}
      />

      <ItemLinks boardId={boardId} kind="GOAL" parentId={data.id} />

      <Separator />

      <LinkedTasks
        boardId={boardId}
        heading="Tasks toward this goal"
        tasks={tasks.data ?? []}
        isPending={tasks.isPending}
        link={{ goalId: data.id }}
      />

      {canManage && (
        <>
          <Separator />
          <ItemActions
            boardId={boardId}
            kind="GOAL"
            id={data.id}
            itemLabel="goal"
            archivedAt={data.archivedAt}
            liveTaskCount={data.taskCount}
            archivedTaskCount={data.archivedTaskCount ?? 0}
            linkedTaskCount={data.linkedTaskCount ?? 0}
            deletePending={deleteGoal.isPending}
            onDelete={(cascadeTasks) =>
              deleteGoal.mutate(
                { goalId: data.id, cascadeTasks },
                { onSuccess: onClose },
              )
            }
            onDone={onClose}
          />
        </>
      )}
    </div>
  );
}
