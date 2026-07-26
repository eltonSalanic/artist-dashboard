"use client";

import { useState } from "react";
import { GoalPeriods, type GoalPeriod } from "@artist/shared";
import { usePermissions } from "@/features/auth/permissions";
import { ItemActions } from "@/features/archive/item-actions";
import { useTasks } from "@/features/tasks/use-tasks";
import { useDeleteGoal, useGoal, useUpdateGoal } from "./use-goals";
import { useDetailParams } from "./use-detail-params";
import { formatDate, formatLocalDate, goalPeriodLabel } from "./planning-bits";
import { LinkedTasks } from "./linked-tasks";
import type { GoalDto } from "./types";
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
import { Textarea } from "@/components/ui/textarea";

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
  const deleteGoal = useDeleteGoal(boardId);
  const tasks = useTasks(boardId, { goalId: data.id });

  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description ?? "");
  const canManage = can("goal.manage");
  const completed = data.completedAt !== null;

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== data.title) {
      updateGoal.mutate({ goalId: data.id, dto: { title: trimmed } });
    }
  };
  const saveDescription = () => {
    const value = description.trim() || null;
    if (value !== (data.description ?? null)) {
      updateGoal.mutate({ goalId: data.id, dto: { description: value } });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
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
                updateGoal.mutate({
                  goalId: data.id,
                  dto: { completed: checked === true },
                })
              }
            />
            {completed ? "Completed" : "In progress"}
          </label>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="goal-description">Description</FieldLabel>
        {canManage ? (
          <Textarea
            id="goal-description"
            placeholder="What does hitting this goal look like?"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {data.description || "No description."}
          </p>
        )}
      </Field>

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
