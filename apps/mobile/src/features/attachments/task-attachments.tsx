import { useState } from 'react';
import { View } from 'react-native';
import {
  notify,
  useAttachments,
  useDeleteAttachment,
  useMe,
  usePermissions,
  useRenameAttachment,
  useUploadAttachment,
  type UploadSource,
} from '@artist/api-client';
import { Button } from '@/components/button';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/theme';
import { AttachmentGrid } from './attachment-grid';
import { NameSheet } from './name-sheet';
import { pickUpload, type PickFrom } from './pick';

/**
 * Files attached to a task itself (a comment's files show under the comment),
 * or to an event: a show's rider, stage plot or setlist.
 *
 * Three plain buttons rather than one "Attach" behind a menu: the choice is the
 * whole interaction, a cross-platform menu would need its own sheet, and on
 * Android an alert holds only three buttons — one short of three sources and a
 * cancel. Whatever is picked is named before it uploads: a camera photo
 * otherwise arrives called "photo-2026-10-08-14-02-11.jpg".
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
  const rename = useRenameAttachment(boardId, parent);
  const [picked, setPicked] = useState<{ source: UploadSource; preview?: string } | null>(null);
  const myId = me.data?.user.id;
  // Whoever manages the parent may rename or delete anyone's upload.
  const manages = can('eventId' in parent ? 'event.manage' : 'task.editFields');

  const add = async (from: PickFrom) => {
    try {
      const picked = await pickUpload(from);
      if (picked) setPicked(picked);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not open the picker');
    }
  };

  const files = attachments.data ?? [];

  return (
    <Section title={files.length > 0 ? `ATTACHMENTS · ${files.length}` : 'ATTACHMENTS'}>
      {attachments.isPending ? (
        <Skeleton width="100%" height={110} />
      ) : files.length > 0 ? (
        <AttachmentGrid
          boardId={boardId}
          attachments={files}
          // The API's rule: your own uploads, or anything if you manage it.
          canManage={(attachment) => attachment.uploadedBy.id === myId || manages}
          onRename={(attachmentId, fileName) =>
            rename.mutateAsync({ attachmentId, dto: { fileName } })
          }
          onDelete={(attachmentId) => remove.mutateAsync(attachmentId)}
        />
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

      {picked && (
        <NameSheet
          title="Name this file"
          fileName={picked.source.fileName}
          previewUri={picked.preview}
          confirmLabel="Upload"
          onCancel={() => setPicked(null)}
          onConfirm={(fileName) => {
            upload.mutate({ ...picked.source, fileName });
            setPicked(null);
          }}
        />
      )}
    </Section>
  );
}
