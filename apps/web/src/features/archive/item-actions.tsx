"use client";

import { useState } from "react";
import type { ArchiveKind } from "@artist/shared";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, type ConfirmMode } from "./confirm-dialog";
import { useArchiveItem, useRestoreItem } from "./use-archive";

/**
 * The Archive/Delete pair that closes every detail modal. Both actions are
 * admin-only and both go through a confirmation — deleting is irreversible,
 * and archiving is worth explaining once, since the item doesn't vanish so
 * much as move somewhere the user hasn't been yet.
 *
 * Archiving and restoring are handled here; deleting is left to the caller,
 * because each entity has its own delete hook.
 */
export function ItemActions({
  boardId,
  kind,
  id,
  itemLabel,
  archivedAt,
  liveTaskCount = 0,
  archivedTaskCount = 0,
  linkedTaskCount = 0,
  deletePending = false,
  onDelete,
  onDone,
}: {
  boardId: string;
  kind: ArchiveKind;
  id: string;
  /** What the item is called in the copy — "goal", "show", "reminder". */
  itemLabel: string;
  archivedAt: string | null;
  /** Live linked tasks — offered on archive. Goals and events only. */
  liveTaskCount?: number;
  /** Tasks archived with this item — offered on restore. */
  archivedTaskCount?: number;
  /** Every linked task — offered on delete, which takes archived ones too. */
  linkedTaskCount?: number;
  deletePending?: boolean;
  onDelete: (cascadeTasks: boolean) => void;
  /** Close the modal — the item is about to leave the view behind it. */
  onDone: () => void;
}) {
  const archiveItem = useArchiveItem(boardId);
  const restoreItem = useRestoreItem(boardId);
  const [mode, setMode] = useState<ConfirmMode | null>(null);

  const archived = archivedAt !== null;
  const cascadeCount =
    mode === "archive"
      ? liveTaskCount
      : mode === "restore"
        ? archivedTaskCount
        : linkedTaskCount;

  const confirm = (cascadeTasks: boolean) => {
    const done = { onSuccess: onDone };
    if (mode === "delete") onDelete(cascadeTasks);
    else if (mode === "restore")
      restoreItem.mutate({ kind, id, cascadeTasks }, done);
    else archiveItem.mutate({ kind, id, cascadeTasks }, done);
    setMode(null);
  };

  return (
    <div className="flex justify-end gap-2">
      {archived ? (
        // Getting it back is the main thing you came here to do.
        <Button
          disabled={restoreItem.isPending}
          onClick={() => setMode("restore")}
        >
          <ArchiveRestore data-icon="inline-start" />
          Unarchive
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled={archiveItem.isPending}
          onClick={() => setMode("archive")}
        >
          <Archive data-icon="inline-start" />
          Archive
        </Button>
      )}
      <Button
        variant="destructive"
        disabled={deletePending}
        onClick={() => setMode("delete")}
      >
        <Trash2 data-icon="inline-start" />
        Delete
      </Button>

      <ConfirmDialog
        open={mode !== null}
        onOpenChange={(open) => !open && setMode(null)}
        // Keep the last mode's copy while the dialog animates closed.
        mode={mode ?? "archive"}
        itemLabel={itemLabel}
        cascadeCount={cascadeCount}
        pending={
          archiveItem.isPending || restoreItem.isPending || deletePending
        }
        onConfirm={confirm}
      />
    </div>
  );
}
