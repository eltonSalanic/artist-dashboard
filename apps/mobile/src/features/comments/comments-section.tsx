import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import {
  collectMentionIds,
  splitMentions,
  type MentionTarget,
} from '@artist/shared';
import {
  useBoard,
  useComments,
  useCreateComment,
  useDeleteAttachment,
  useRenameAttachment,
  useDeleteComment,
  useMe,
  usePermissions,
  useUpdateComment,
  type CommentDto,
} from '@artist/api-client';
import { Icon } from '@/components/icon';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { PosterText } from '@/components/poster-text';
import { AttachmentGrid } from '@/features/attachments/attachment-grid';
import { shortAgo } from '@/features/board/format';
import { face, spacing, useThemeColors } from '@/theme';
import { CommentComposer } from './comment-composer';

/**
 * A task's comments, oldest first like a conversation, with the composer
 * underneath. Mentions are resolved against the board's members — the same
 * parser web uses, from `@artist/shared` — so "@Sam" written here notifies the
 * person web would have notified.
 */
export function CommentsSection({
  boardId,
  taskId,
}: {
  boardId: string;
  taskId: string;
}) {
  const colors = useThemeColors();
  const { can } = usePermissions();
  const board = useBoard(boardId);
  const comments = useComments(boardId, taskId);
  const create = useCreateComment(boardId, taskId);
  const [draft, setDraft] = useState('');

  const members: MentionTarget[] = (board.data?.members ?? []).map((m) => ({
    id: m.userId,
    displayName: m.displayName,
  }));

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    create.mutate(
      { body, mentions: collectMentionIds(body, members) },
      { onSuccess: () => setDraft('') },
    );
  };

  const list = comments.data ?? [];

  return (
    <Section title={list.length > 0 ? `COMMENTS · ${list.length}` : 'COMMENTS'}>
      {comments.isPending ? (
        <Skeleton width="100%" height={60} />
      ) : list.length > 0 ? (
        <View style={{ gap: spacing.md, paddingVertical: spacing.xs }}>
          {list.map((comment) => (
            <CommentItem
              key={comment.id}
              boardId={boardId}
              taskId={taskId}
              comment={comment}
              members={members}
            />
          ))}
        </View>
      ) : (
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          No comments yet.
        </PosterText>
      )}

      {can('task.comment') && (
        <View style={{ marginTop: spacing.sm }}>
          <CommentComposer
            value={draft}
            onChange={setDraft}
            members={members}
            onSubmit={submit}
            busy={create.isPending}
          />
        </View>
      )}
    </Section>
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
  members: MentionTarget[];
}) {
  const colors = useThemeColors();
  const { can } = usePermissions();
  const me = useMe(true);
  const update = useUpdateComment(boardId, taskId);
  const remove = useDeleteComment(boardId, taskId);
  const removeFile = useDeleteAttachment(boardId, { commentId: comment.id });
  const renameFile = useRenameAttachment(boardId, { commentId: comment.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  const myId = me.data?.user.id;
  const isAuthor = myId === comment.author.id;
  // The API's rules: only the author edits; the author or an admin deletes.
  const canEdit = isAuthor;
  const canDelete = isAuthor || can('task.editFields');

  const save = () => {
    const body = draft.trim();
    if (!body) return;
    update.mutate(
      {
        commentId: comment.id,
        dto: { body, mentions: collectMentionIds(body, members) },
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const confirmDelete = () =>
    Alert.alert('Delete this comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(comment.id),
      },
    ]);

  // An alert, not a custom menu: two actions at most, and Android's alert
  // holds exactly three buttons with cancel.
  const showActions = () =>
    Alert.alert('Comment', undefined, [
      ...(canEdit
        ? [
            {
              text: 'Edit',
              onPress: () => {
                setDraft(comment.body);
                setEditing(true);
              },
            },
          ]
        : []),
      ...(canDelete
        ? [{ text: 'Delete', style: 'destructive' as const, onPress: confirmDelete }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <PosterText variant="rowTitle" color={colors.foreground} style={{ flexShrink: 1 }}>
          {comment.author.displayName}
        </PosterText>
        <PosterText variant="cardMeta" color={colors.mutedForeground} style={{ flex: 1 }}>
          {`${shortAgo(comment.createdAt)}${comment.editedAt ? ' · edited' : ''}`}
        </PosterText>
        {(canEdit || canDelete) && !editing && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comment actions"
            hitSlop={12}
            onPress={showActions}
          >
            <Icon
              name={{ sf: 'ellipsis', md: 'more-horiz' }}
              size={17}
              color={colors.mutedForeground}
            />
          </Pressable>
        )}
      </View>

      {editing ? (
        <CommentComposer
          value={draft}
          onChange={setDraft}
          members={members}
          onSubmit={save}
          onCancel={() => setEditing(false)}
          submitLabel="Save"
          autoFocus
          busy={update.isPending}
        />
      ) : (
        <PosterText variant="paragraph" color={colors.foreground}>
          {splitMentions(comment.body, members).map((segment, i) =>
            segment.type === 'mention' ? (
              // A family, not a weight: Figtree's weights are separate faces.
              <PosterText
                key={i}
                variant="paragraph"
                color={colors.primary}
                style={{ fontFamily: face.bold }}
              >
                {segment.value}
              </PosterText>
            ) : (
              segment.value
            ),
          )}
        </PosterText>
      )}

      {comment.attachments.length > 0 && (
        <AttachmentGrid
          boardId={boardId}
          attachments={comment.attachments}
          // The API's rule: your own uploads, or anything as an admin.
          canManage={(attachment) =>
            attachment.uploadedBy.id === myId || can('task.editFields')
          }
          onRename={(attachmentId, fileName) =>
            renameFile.mutateAsync({ attachmentId, dto: { fileName } })
          }
          onDelete={(attachmentId) => removeFile.mutateAsync(attachmentId)}
        />
      )}
    </View>
  );
}
