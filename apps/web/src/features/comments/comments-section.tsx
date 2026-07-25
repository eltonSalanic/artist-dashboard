"use client";

import { useRef, useState } from "react";
import { Paperclip, Pencil, Trash2, X } from "lucide-react";
import type { BoardMemberDto } from "@/features/auth/types";
import { usePermissions } from "@/features/auth/permissions";
import { useMe } from "@/features/auth/use-me";
import { labelStyle } from "@/lib/label-style";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentComposer } from "./comment-composer";
import {
  AttachmentRow,
  CommentBody,
  relativeTime,
} from "./comment-bits";
import { collectMentionIds } from "./mentions";
import type { CommentDto } from "./types";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "./use-comments";
import {
  useDeleteAttachment,
  useUploadAttachment,
} from "./use-attachments";

export function CommentsSection({
  boardId,
  taskId,
  members,
}: {
  boardId: string;
  taskId: string;
  members: BoardMemberDto[];
}) {
  const { can } = usePermissions();
  const comments = useComments(boardId, taskId);
  const createComment = useCreateComment(boardId, taskId);
  const [draft, setDraft] = useState("");

  const targets = members.map((m) => ({
    id: m.userId,
    displayName: m.displayName,
  }));

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    createComment.mutate(
      { body, mentions: collectMentionIds(body, targets) },
      { onSuccess: () => setDraft("") },
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className={labelStyle}>
        Comments
        {comments.data && comments.data.length > 0 && (
          <span className="ml-1 text-muted-foreground">
            ({comments.data.length})
          </span>
        )}
      </h3>

      {comments.isPending ? (
        <Skeleton className="h-20" />
      ) : comments.data && comments.data.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {comments.data.map((comment) => (
            <CommentItem
              key={comment.id}
              boardId={boardId}
              taskId={taskId}
              comment={comment}
              members={targets}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}

      {can("task.comment") && (
        <CommentComposer
          value={draft}
          onChange={setDraft}
          members={targets}
          onSubmit={submit}
          busy={createComment.isPending}
        />
      )}
    </section>
  );
}

function CommentItem({
  boardId,
  taskId,
  comment,
  members,
}: {
  boardId: string;
  taskId: string;
  comment: CommentDto;
  members: { id: string; displayName: string }[];
}) {
  const { can } = usePermissions();
  const me = useMe(true);
  const updateComment = useUpdateComment(boardId, taskId);
  const deleteComment = useDeleteComment(boardId, taskId);
  const upload = useUploadAttachment(boardId, { commentId: comment.id });
  const deleteAttachment = useDeleteAttachment(boardId, {
    commentId: comment.id,
  });
  const fileInput = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  const myId = me.data?.user.id;
  const isAuthor = myId === comment.author.id;
  const canEdit = isAuthor;
  const canDelete = isAuthor || can("task.editFields"); // admins delete any
  const canAttach = can("file.upload");

  const saveEdit = () => {
    const body = draft.trim();
    if (!body) return;
    updateComment.mutate(
      { commentId: comment.id, dto: { body, mentions: collectMentionIds(body, members) } },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <li className="flex gap-3">
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="text-[10px]">
          {comment.author.displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {comment.author.displayName}
          </span>
          <span className="text-xs text-muted-foreground">
            {relativeTime(comment.createdAt)}
            {comment.editedAt && " · edited"}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            {canAttach && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Attach file to comment"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip />
              </Button>
            )}
            {canEdit && !editing && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit comment"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(true);
                }}
              >
                <Pencil />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete comment"
                onClick={() => deleteComment.mutate(comment.id)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-1">
            <CommentComposer
              value={draft}
              onChange={setDraft}
              members={members}
              onSubmit={saveEdit}
              submitLabel="Save"
              autoFocus
              busy={updateComment.isPending}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
            >
              <X data-icon="inline-start" />
              Cancel
            </Button>
          </div>
        ) : (
          <CommentBody body={comment.body} members={members} />
        )}

        {comment.attachments.length > 0 && (
          <div className="flex flex-col gap-1 pt-1">
            {comment.attachments.map((attachment) => (
              <AttachmentRow
                key={attachment.id}
                boardId={boardId}
                attachment={attachment}
                onDelete={
                  isAuthor || can("task.editFields")
                    ? () => deleteAttachment.mutate(attachment.id)
                    : undefined
                }
              />
            ))}
          </div>
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
      </div>
    </li>
  );
}
