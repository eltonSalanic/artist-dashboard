"use client";

import { useRef } from "react";
import { Paperclip, Upload } from "lucide-react";
import { usePermissions } from "@artist/api-client";
import { useMe } from "@artist/api-client";
import { labelStyle } from "@/lib/label-style";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentRow } from "./comment-bits";
import {
  useAttachments,
  useDeleteAttachment,
  useRenameAttachment,
  useUploadAttachment,
} from "@artist/api-client";
import { useNamedUpload } from "./file-name-dialog";

/**
 * Files attached directly to a task (not to one of its comments), or to an
 * event — a show's rider, stage plot or setlist.
 */
export function TaskAttachments({
  boardId,
  parent,
}: {
  boardId: string;
  parent: { taskId: string } | { eventId: string };
}) {
  const { can } = usePermissions();
  const me = useMe(true);
  const attachments = useAttachments(boardId, parent);
  const upload = useUploadAttachment(boardId, parent);
  const deleteAttachment = useDeleteAttachment(boardId, parent);
  const rename = useRenameAttachment(boardId, parent);
  const named = useNamedUpload((source) => upload.mutate(source));
  // Anyone may delete their own upload; whoever manages the parent, anyone's.
  const manages = can("eventId" in parent ? "event.manage" : "task.editFields");
  const fileInput = useRef<HTMLInputElement>(null);
  const canUpload = can("file.upload");
  const myId = me.data?.user.id;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className={labelStyle}>Attachments</h3>
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
                attachment.uploadedBy.id === myId || manages
                  ? () => deleteAttachment.mutate(attachment.id)
                  : undefined
              }
              onRename={
                attachment.uploadedBy.id === myId || manages
                  ? (fileName) =>
                      rename.mutateAsync({
                        attachmentId: attachment.id,
                        dto: { fileName },
                      })
                  : undefined
              }
              renaming={rename.isPending}
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
          if (file) named.pick(file);
          e.target.value = "";
        }}
      />
      {named.dialog}
    </section>
  );
}
