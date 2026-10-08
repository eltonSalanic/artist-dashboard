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
 * Files attached to a task itself (a comment's files show under the comment),
 * or to an event: a show's rider, stage plot or setlist.
 *
 * Three plain buttons rather than one "Attach" behind a menu: the choice is the
 * whole interaction, a cross-platform menu would need its own sheet, and on
 * Android an alert holds only three buttons — one short of three sources and a
 * cancel.
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
  const remove = useDeleteAttachment(boardId, parent);
  const myId = me.data?.user.id;
  // Whoever manages the parent may delete anyone's upload.
  const manages = can('eventId' in parent ? 'event.manage' : 'task.editFields');

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
              attachment.uploadedBy.id === myId || manages
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
