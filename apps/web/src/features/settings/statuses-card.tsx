"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useCreateStatus,
  useDeleteStatus,
  useStatuses,
  useUpdateStatus,
} from "@artist/api-client";
import type { TaskStatusDto } from "@artist/api-client";
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

export function StatusesCard({ boardId }: { boardId: string }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4f7cff");

  const statuses = useStatuses(boardId);
  const createStatus = useCreateStatus(boardId);
  const updateStatus = useUpdateStatus(boardId);
  const deleteStatus = useDeleteStatus(boardId);

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
            if (newName.trim()) {
              createStatus.mutate(
                { name: newName.trim(), color: newColor },
                { onSuccess: () => setNewName("") },
              );
            }
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
