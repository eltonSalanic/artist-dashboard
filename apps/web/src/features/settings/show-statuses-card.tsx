"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ShowStatusCategories, type ShowStatusCategory } from "@artist/shared";
import {
  useCreateShowStatus,
  useDeleteShowStatus,
  useShowStatuses,
  useUpdateShowStatus,
} from "@artist/api-client";
import type { ShowStatusDto } from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

/** What each category does, in the band's terms. */
const categoryLabel: Record<ShowStatusCategory, string> = {
  HOLD: "Hold",
  BOOKED: "Booked",
  CANCELLED: "Cancelled",
};

export function ShowStatusesCard({ boardId }: { boardId: string }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4f7cff");
  const [newCategory, setNewCategory] = useState<ShowStatusCategory>("BOOKED");

  const statuses = useShowStatuses(boardId);
  const createStatus = useCreateShowStatus(boardId);
  const updateStatus = useUpdateShowStatus(boardId);
  const deleteStatus = useDeleteShowStatus(boardId);
  const list = statuses.data ?? [];

  // Swapping sort orders with the neighbour keeps every value distinct.
  const move = (index: number, delta: -1 | 1) => {
    const a = list[index];
    const b = list[index + delta];
    if (!a || !b) return;
    updateStatus.mutate({ statusId: a.id, dto: { sortOrder: b.sortOrder } });
    updateStatus.mutate({ statusId: b.id, dto: { sortOrder: a.sortOrder } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Show statuses</CardTitle>
        <CardDescription>
          Where a show stands. The type decides how the app treats it: holds
          look tentative, booked shows count, cancelled ones drop out of lists.
          Past shows read as played on their own. New shows start in the first
          status that isn&rsquo;t cancelled.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {statuses.isPending && <Skeleton className="h-24" />}
        {list.map((status, index) => (
          <ShowStatusRow
            key={status.id}
            status={status}
            isFirst={index === 0}
            isLast={index === list.length - 1}
            onMove={(delta) => move(index, delta)}
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
                { name: newName.trim(), color: newColor, category: newCategory },
                { onSuccess: () => setNewName("") },
              );
            }
          }}
        >
          <input
            type="color"
            aria-label="New show status color"
            className="size-8 shrink-0 cursor-pointer rounded border bg-transparent"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
          />
          <Input
            aria-label="New show status name"
            placeholder="Add a show status…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <CategorySelect
            label="Type of new show status"
            value={newCategory}
            onChange={setNewCategory}
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

function CategorySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ShowStatusCategory;
  onChange: (value: ShowStatusCategory) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v as ShowStatusCategory)}
      items={ShowStatusCategories.map((c) => ({
        value: c,
        label: categoryLabel[c],
      }))}
    >
      <SelectTrigger aria-label={label} size="sm" className="w-32 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {ShowStatusCategories.map((c) => (
            <SelectItem key={c} value={c}>
              {categoryLabel[c]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ShowStatusRow({
  status,
  isFirst,
  isLast,
  onMove,
  onUpdate,
  onDelete,
}: {
  status: ShowStatusDto;
  isFirst: boolean;
  isLast: boolean;
  onMove: (delta: -1 | 1) => void;
  onUpdate: (
    dto: Partial<Pick<ShowStatusDto, "name" | "color" | "category">>,
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
      <CategorySelect
        label={`Type of ${status.name}`}
        value={status.category}
        onChange={(category) => onUpdate({ category })}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${status.name} up`}
        disabled={isFirst}
        onClick={() => onMove(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${status.name} down`}
        disabled={isLast}
        onClick={() => onMove(1)}
      >
        <ArrowDown />
      </Button>
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
