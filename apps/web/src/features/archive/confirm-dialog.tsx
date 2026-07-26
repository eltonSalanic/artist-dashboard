"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmMode = "archive" | "restore" | "delete";

const COPY = {
  archive: {
    Icon: Archive,
    title: (label: string) => `Archive this ${label}?`,
    body: (
      <>
        It comes off your dashboard, but it isn&apos;t gone — you&apos;ll find
        it on the <strong>Archive</strong> page, and you can put it back any
        time.
      </>
    ),
    confirm: "Archive",
    variant: "default" as const,
  },
  restore: {
    Icon: ArchiveRestore,
    title: (label: string) => `Put this ${label} back?`,
    body: <>It returns to your dashboard and leaves the archive.</>,
    confirm: "Restore",
    variant: "default" as const,
  },
  delete: {
    Icon: Trash2,
    title: (label: string) => `Permanently delete this ${label}?`,
    body: (
      <>
        <strong>This cannot be undone.</strong> It disappears from your
        dashboard and the archive alike. If you only want it out of the way,
        archive it instead — archived items stay readable on the{" "}
        <strong>Archive</strong> page.
      </>
    ),
    confirm: "Delete forever",
    variant: "destructive" as const,
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  mode,
  itemLabel,
  cascadeCount = 0,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ConfirmMode;
  /** What the item is called in the copy — "goal", "show", "reminder". */
  itemLabel: string;
  /** Linked tasks this action can sweep along. Zero hides the checkbox. */
  cascadeCount?: number;
  pending?: boolean;
  onConfirm: (cascadeTasks: boolean) => void;
}) {
  const [cascade, setCascade] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const { Icon, title, body, confirm, variant } = COPY[mode];

  // Taking the linked tasks along is never the default — reaching for it has
  // to be deliberate, especially when the action is delete. Reset on the way
  // open, during render, so a stale tick never carries over.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCascade(false);
  }

  const verb =
    mode === "delete" ? "delete" : mode === "restore" ? "restore" : "archive";
  const noun = cascadeCount === 1 ? "task" : "tasks";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            {title(itemLabel)}
          </DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>

        {cascadeCount > 0 && (
          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <Checkbox
              checked={cascade}
              onCheckedChange={(checked) => setCascade(checked === true)}
            />
            <span>
              Also {verb} the {cascadeCount}{" "}
              {mode === "restore" ? `archived ${noun}` : noun} linked to this{" "}
              {itemLabel}
            </span>
          </label>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant={variant}
            disabled={pending}
            onClick={() => onConfirm(cascade)}
          >
            <Icon data-icon="inline-start" />
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
