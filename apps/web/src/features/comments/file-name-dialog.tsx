"use client";

import { useState } from "react";
import { splitFileName, withExtension } from "@artist/shared";
import type { UploadSource } from "@artist/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fromFile } from "./use-attachments";

/**
 * Names a file: a new upload before it goes, or an existing one.
 *
 * Only the part before the extension is editable; the extension stays beside
 * the field, so a renamed rider still downloads as a PDF. Mounted fresh on each
 * open (callers key it), so the field always starts from the file's own name.
 */
export function FileNameDialog({
  open,
  onOpenChange,
  title,
  fileName,
  confirmLabel,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The current name, extension included. */
  fileName: string;
  confirmLabel: string;
  pending?: boolean;
  /** The full new name, extension put back on. */
  onConfirm: (fileName: string) => void;
}) {
  const { base, extension } = splitFileName(fileName);
  const [draft, setDraft] = useState(base);
  const next = withExtension(draft, extension);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            What your band sees, and what a download saves as.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (next && !pending) onConfirm(next);
          }}
        >
          <Input
            autoFocus
            aria-label="File name"
            value={draft}
            maxLength={255}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.target.select()}
          />
          {extension && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {extension}
            </span>
          )}
          {/* Lets Enter submit; the visible buttons are in the footer. */}
          <button type="submit" hidden />
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!next || pending}
            onClick={() => next && onConfirm(next)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Asks for a name between choosing a file and uploading it. Returns `pick`
 * for the file input's change handler and the dialog to render beside it.
 */
export function useNamedUpload(upload: (source: UploadSource) => void) {
  const [picked, setPicked] = useState<File | null>(null);
  // Bumped per pick, so the dialog mounts fresh with the new file's name.
  const [round, setRound] = useState(0);

  const pick = (file: File) => {
    setPicked(file);
    setRound((n) => n + 1);
  };

  const dialog = picked ? (
    <FileNameDialog
      key={round}
      open
      onOpenChange={(open) => !open && setPicked(null)}
      title="Name this file"
      fileName={picked.name}
      confirmLabel="Upload"
      onConfirm={(fileName) => {
        upload({ ...fromFile(picked), fileName });
        setPicked(null);
      }}
    />
  ) : null;

  return { pick, dialog };
}
