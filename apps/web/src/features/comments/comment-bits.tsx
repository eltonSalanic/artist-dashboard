"use client";

import { useState } from "react";
import {
  Download,
  Eye,
  FileAudio,
  FileText,
  Paperclip,
  Trash2,
} from "lucide-react";
import { splitMentions, type MentionTarget } from "./mentions";
import type { AttachmentDto } from "./types";
import { AttachmentViewer } from "./attachment-viewer";
import { downloadAttachment, isPreviewable } from "./use-attachments";
import { Button } from "@/components/ui/button";

/** "just now" / "5m" / "3h" / "2d", then a plain date once it's old. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Comment body rendered as plain text — no markdown. Newlines are preserved
 * and `@mentions` are highlighted as inert chips.
 */
export function CommentBody({
  body,
  members,
}: {
  body: string;
  members: MentionTarget[];
}) {
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
      {splitMentions(body, members).map((seg, i) =>
        seg.type === "mention" ? (
          <span
            key={i}
            className="rounded bg-primary/10 px-1 font-medium text-primary"
          >
            {seg.value}
          </span>
        ) : (
          <span key={i}>{seg.value}</span>
        ),
      )}
    </div>
  );
}

function AttachmentIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) {
  if (mimeType.startsWith("audio/"))
    return <FileAudio className={className} />;
  if (mimeType === "application/pdf")
    return <FileText className={className} />;
  return <Paperclip className={className} />;
}

export function AttachmentRow({
  boardId,
  attachment,
  onDelete,
}: {
  boardId: string;
  attachment: AttachmentDto;
  onDelete?: () => void;
}) {
  const [viewing, setViewing] = useState(false);
  const canPreview = isPreviewable(attachment.mimeType);

  // Clicking the name previews when we can render the type, else downloads.
  const primaryAction = () =>
    canPreview ? setViewing(true) : downloadAttachment(boardId, attachment.id);

  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
      <AttachmentIcon
        mimeType={attachment.mimeType}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
        onClick={primaryAction}
        title={
          canPreview
            ? `View ${attachment.fileName}`
            : `Download ${attachment.fileName}`
        }
      >
        {attachment.fileName}
      </button>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatBytes(attachment.size)}
      </span>
      {canPreview && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`View ${attachment.fileName}`}
          onClick={() => setViewing(true)}
        >
          <Eye />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Download ${attachment.fileName}`}
        onClick={() => downloadAttachment(boardId, attachment.id)}
      >
        <Download />
      </Button>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${attachment.fileName}`}
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      )}

      {canPreview && (
        <AttachmentViewer
          boardId={boardId}
          attachment={attachment}
          open={viewing}
          onOpenChange={setViewing}
        />
      )}
    </div>
  );
}
