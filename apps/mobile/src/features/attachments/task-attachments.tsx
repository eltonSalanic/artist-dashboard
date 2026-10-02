import { View } from 'react-native';
import {
  notify,
  useAttachments,
  useDeleteAttachment,
  useMe,
  usePermissions,
  useUploadAttachment,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/theme';
import { AttachmentRow } from './attachment-row';
import { pickUpload, type PickFrom } from './pick';

/**
 * Files attached to the task itself (a comment's files show under the comment).
 *
 * Three plain buttons rather than one "Attach" behind a menu: the choice is the
 * whole interaction, a cross-platform menu would need its own sheet, and on
 * Android an alert holds only three buttons — one short of three sources and a
 * cancel.
 */
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
  const remove = useDeleteAttachment(boardId, { taskId });
  const myId = me.data?.user.id;

  const add = async (from: PickFrom) => {
    try {
      const source = await pickUpload(from);
      if (source) upload.mutate(source);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not open the picker');
    }
  };

  const files = attachments.data ?? [];

  return (
    <Section title={files.length > 0 ? `ATTACHMENTS · ${files.length}` : 'ATTACHMENTS'}>
      {attachments.isPending ? (
        <Skeleton width="100%" height={44} />
      ) : files.length > 0 ? (
        files.map((attachment, index) => (
          <AttachmentRow
            key={attachment.id}
            boardId={boardId}
            attachment={attachment}
            first={index === 0}
            // The API's rule: your own uploads, or anything if you are an admin.
            onDelete={
              attachment.uploadedBy.id === myId || can('task.editFields')
                ? () => remove.mutate(attachment.id)
                : undefined
            }
          />
        ))
      ) : (
        <ThemedText variant="subhead" tone="muted">
          No files attached.
        </ThemedText>
      )}

      {upload.isPending && (
        <ThemedText variant="footnote" tone="muted">
          Uploading {upload.variables?.fileName}…
        </ThemedText>
      )}

      {can('file.upload') && (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          {(
            [
              ['camera', 'Camera'],
              ['photos', 'Photos'],
              ['files', 'Files'],
            ] as const
          ).map(([from, title]) => (
            <Button
              key={from}
              title={title}
              variant="secondary"
              size="sm"
              disabled={upload.isPending}
              onPress={() => void add(from)}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      )}
    </Section>
  );
}
