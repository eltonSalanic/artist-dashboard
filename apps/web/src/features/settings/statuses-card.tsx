"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import type { TaskStatusDto } from "@/features/auth/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

export function StatusesCard({ boardId }: { boardId: string }) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4f7cff");

  const statuses = useQuery({
    queryKey: ["statuses", boardId],
    queryFn: () => apiFetch<TaskStatusDto[]>(`/boards/${boardId}/statuses`),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["statuses", boardId] });
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
  };

  const createStatus = useMutation({
    mutationFn: () =>
      apiFetch(`/boards/${boardId}/statuses`, {
        method: "POST",
        body: { name: newName.trim(), color: newColor },
      }),
    onSuccess: () => {
      setNewName("");
      invalidate();
    },
    onError: showError,
  });

  const updateStatus = useMutation({
    mutationFn: ({
      statusId,
      dto,
    }: {
      statusId: string;
      dto: Partial<Pick<TaskStatusDto, "name" | "color" | "isDone">>;
    }) =>
      apiFetch(`/boards/${boardId}/statuses/${statusId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });

  const deleteStatus = useMutation({
    mutationFn: (statusId: string) =>
      apiFetch(`/boards/${boardId}/statuses/${statusId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
    onError: showError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task statuses</CardTitle>
        <CardDescription>
          Statuses tasks move through. &ldquo;Counts as done&rdquo; controls
          completion.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {statuses.isPending && <Skeleton className="h-24" />}
        {statuses.data?.map((status) => (
          <StatusRow
            key={status.id}
            status={status}
            onUpdate={(dto) => updateStatus.mutate({ statusId: status.id, dto })}
            onDelete={() => deleteStatus.mutate(status.id)}
          />
        ))}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) createStatus.mutate();
          }}
        >
          <input
            type="color"
            aria-label="New status color"
            className="size-8 shrink-0 cursor-pointer rounded border bg-transparent"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
          />
          <Input
            aria-label="New status name"
            placeholder="Add a status…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={createStatus.isPending}>
            <Plus data-icon="inline-start" />
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  status,
  onUpdate,
  onDelete,
}: {
  status: TaskStatusDto;
  onUpdate: (
    dto: Partial<Pick<TaskStatusDto, "name" | "color" | "isDone">>,
  ) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(status.name);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={`Color for ${status.name}`}
        className="size-8 shrink-0 cursor-pointer rounded border bg-transparent"
        value={status.color}
        onChange={(e) => onUpdate({ color: e.target.value })}
      />
      <Input
        aria-label={`Rename ${status.name}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== status.name) onUpdate({ name: trimmed });
        }}
      />
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Checkbox
          checked={status.isDone}
          onCheckedChange={(checked) => onUpdate({ isDone: checked === true })}
        />
        Counts as done
      </label>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${status.name}`}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
