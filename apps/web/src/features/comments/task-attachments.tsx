"use client";

import { useRef } from "react";
import { Paperclip, Upload } from "lucide-react";
import { usePermissions } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentRow } from "./comment-bits";
import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from "./use-attachments";

/** Files attached directly to the task (not to a comment). */
export function TaskAttachments({
  boardId,
  taskId,
}: {
  boardId: string;
  taskId: string;
}) {
  const { can } = usePermissions();
  const me = useMe(true);
  const attachments = useAttachments(boardId, { taskId });
  const upload = useUploadAttachment(boardId, { taskId });
  const deleteAttachment = useDeleteAttachment(boardId, { taskId });
  const fileInput = useRef<HTMLInputElement>(null);
  const canUpload = can("file.upload");
  const myId = me.data?.user.id;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Attachments</h3>
        {canUpload && (
          <Button
            variant="outline"
            size="sm"
            disabled={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            <Upload data-icon="inline-start" />
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        )}
      </div>

      {attachments.isPending ? (
        <Skeleton className="h-12" />
      ) : attachments.data && attachments.data.length > 0 ? (
        <div className="flex flex-col gap-1">
          {attachments.data.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              boardId={boardId}
              attachment={attachment}
              onDelete={
                attachment.uploadedBy.id === myId || can("task.editFields")
                  ? () => deleteAttachment.mutate(attachment.id)
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="size-4" />
          No files attached.
        </p>
      )}

      <input
        ref={fileInput}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
    </section>
  );
}
