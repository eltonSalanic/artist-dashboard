"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "./comment-bits";
import type { AttachmentDto } from "./types";
import { downloadAttachment, fetchViewUrl } from "./use-attachments";

/**
 * Inline preview for an attachment. The body mounts fresh each time the dialog
 * opens (so a fresh short-lived view URL is fetched every time) and renders by
 * mime type.
 */
export function AttachmentViewer({
  boardId,
  attachment,
  open,
  onOpenChange,
}: {
  boardId: string;
  attachment: AttachmentDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-3 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">
            {attachment.fileName}
          </DialogTitle>
          <DialogDescription>{formatBytes(attachment.size)}</DialogDescription>
        </DialogHeader>

        {open && <ViewerBody boardId={boardId} attachment={attachment} />}

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadAttachment(boardId, attachment.id)}
          >
            <Download data-icon="inline-start" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewerBody({
  boardId,
  attachment,
}: {
  boardId: string;
  attachment: AttachmentDto;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchViewUrl(boardId, attachment.id).then((signed) => {
      if (!active) return;
      if (signed) setUrl(signed);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [boardId, attachment.id]);

  return (
    <div className="flex min-h-40 items-center justify-center overflow-auto">
      {failed ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load the preview.
        </p>
      ) : !url ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Preview
          mimeType={attachment.mimeType}
          url={url}
          fileName={attachment.fileName}
        />
      )}
    </div>
  );
}

function Preview({
  mimeType,
  url,
  fileName,
}: {
  mimeType: string;
  url: string;
  fileName: string;
}) {
  if (mimeType.startsWith("image/")) {
    return (
      // A signed, expiring blob URL — next/image can't optimize it, so a plain img is correct here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={fileName}
        className="max-h-[70vh] w-auto rounded-md object-contain"
      />
    );
  }
  if (mimeType.startsWith("audio/")) {
    return <audio src={url} controls className="w-full" />;
  }
  if (mimeType.startsWith("video/")) {
    return (
      <video src={url} controls className="max-h-[70vh] w-full rounded-md" />
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={url}
        title={fileName}
        className="h-[70vh] w-full rounded-md border"
      />
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      This file type can&apos;t be previewed — download it to open it.
    </p>
  );
}
