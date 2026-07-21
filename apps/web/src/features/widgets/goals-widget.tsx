"use client";

import { useState } from "react";
import { GoalPeriods, type GoalPeriod } from "@artist/shared";
import { Target, Trash2 } from "lucide-react";
import { usePermissions } from "@/features/auth/permissions";
import {
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
} from "@/features/planning/use-goals";
import { useDetailParams } from "@/features/planning/use-detail-params";
import {
  formatDate,
  goalPeriodLabel,
} from "@/features/planning/planning-bits";
import type { GoalDto } from "@/features/planning/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export function GoalsWidget({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const goals = useGoals(boardId, { includeCompleted: false });
  const updateGoal = useUpdateGoal(boardId);
  const { open } = useDetailParams();

  if (goals.isPending) return <Skeleton className="h-full min-h-24" />;

  const items = goals.data ?? [];
  if (items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Target />
          </EmptyMedia>
          <EmptyTitle>No open goals</EmptyTitle>
          <EmptyDescription>
            {can("goal.manage")
              ? "Add goals from the expanded view."
              : "Your admin hasn't set any goals yet."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((goal) => (
        <li
          key={goal.id}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50"
        >
          <Checkbox
            checked={goal.completedAt !== null}
            aria-label={`Mark ${goal.title} complete`}
            disabled={!can("goal.manage")}
            onCheckedChange={(checked) =>
              updateGoal.mutate({
                goalId: goal.id,
                dto: { completed: checked === true },
              })
            }
          />
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-sm"
            onClick={() => open("goal", goal.id)}
          >
            {goal.title}
          </button>
          <Badge variant="outline" className="shrink-0">
            {goalPeriodLabel[goal.period]}
          </Badge>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDate(goal.dueDate)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function GoalsWidgetExpanded({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const goals = useGoals(boardId);
  const createGoal = useCreateGoal(boardId);
  const canManage = can("goal.manage");

  return (
    <div className="flex flex-col gap-4">
      {canManage && <GoalForm onSubmit={(dto) => createGoal.mutate(dto)} />}
      {goals.isPending ? (
        <Skeleton className="h-40" />
      ) : (goals.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No goals yet.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {(goals.data ?? []).map((goal) => (
            <GoalRow
              key={goal.id}
              boardId={boardId}
              goal={goal}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function GoalRow({
  boardId,
  goal,
  canManage,
}: {
  boardId: string;
  goal: GoalDto;
  canManage: boolean;
}) {
  const updateGoal = useUpdateGoal(boardId);
  const deleteGoal = useDeleteGoal(boardId);
  const { open } = useDetailParams();
  const completed = goal.completedAt !== null;

  return (
    <li className="flex items-center gap-2 py-2">
      <Checkbox
        checked={completed}
        aria-label={`Mark ${goal.title} complete`}
        disabled={!canManage}
        onCheckedChange={(checked) =>
          updateGoal.mutate({
            goalId: goal.id,
            dto: { completed: checked === true },
          })
        }
      />
      <button
        type="button"
        className={`min-w-0 flex-1 truncate text-left text-sm ${completed ? "text-muted-foreground line-through" : ""}`}
        onClick={() => open("goal", goal.id)}
      >
        {goal.title}
      </button>
      <Badge variant="outline">{goalPeriodLabel[goal.period]}</Badge>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        {formatDate(goal.dueDate)}
      </span>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
        {goal.taskCount} {goal.taskCount === 1 ? "task" : "tasks"}
      </span>
      {canManage && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${goal.title}`}
          onClick={() => deleteGoal.mutate(goal.id)}
        >
          <Trash2 />
        </Button>
      )}
    </li>
  );
}

function GoalForm({
  onSubmit,
}: {
  onSubmit: (dto: {
    title: string;
    period: GoalPeriod;
    dueDate: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState<GoalPeriod>("MONTHLY");
  const [dueDate, setDueDate] = useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({
          title: title.trim(),
          period,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        });
        setTitle("");
        setDueDate("");
      }}
    >
      <Input
        aria-label="New goal title"
        placeholder="New goal…"
        className="min-w-40 flex-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Select
        value={period}
        onValueChange={(v) => v && setPeriod(v as GoalPeriod)}
        items={GoalPeriods.map((p) => ({
          value: p,
          label: goalPeriodLabel[p],
        }))}
      >
        <SelectTrigger aria-label="Goal period" size="sm">
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
      <Input
        aria-label="Goal due date"
        type="date"
        className="w-40"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <Button type="submit">Add goal</Button>
    </form>
  );
}
