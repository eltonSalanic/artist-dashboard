"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, FileAudio, FileText, Paperclip, Trash2 } from "lucide-react";
import { MENTION_HREF } from "./mentions";
import type { AttachmentDto } from "./types";
import { downloadAttachment } from "./use-attachments";
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
 * Comment markdown. Mentions arrive pre-linkified as `#mention-<id>` hrefs
 * (see linkifyMentions) and render as inert chips; every other link opens in a
 * new tab. GFM covers the practical bits — lists, bold, code, autolinks.
 */
export function CommentMarkdown({ body }: { body: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed wrap-break-word [&_a]:text-primary [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (href?.startsWith(MENTION_HREF)) {
              return (
                <span className="rounded bg-primary/10 px-1 font-medium text-primary">
                  {children}
                </span>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {body}
      </Markdown>
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
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
      <AttachmentIcon
        mimeType={attachment.mimeType}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
        onClick={() => downloadAttachment(boardId, attachment.id)}
        title={`Download ${attachment.fileName}`}
      >
        {attachment.fileName}
      </button>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatBytes(attachment.size)}
      </span>
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
    </div>
  );
}
