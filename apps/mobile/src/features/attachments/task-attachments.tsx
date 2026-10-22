import { useState } from 'react';
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
import { PosterText } from '@/components/poster-text';
import { spacing, useThemeColors } from '@/theme';
import { AttachmentGrid } from './attachment-grid';
import { NameSheet } from './name-sheet';
import { chooseSource, pickUpload } from './pick';

/**
 * Files attached to a task itself (a comment's files show under the comment),
 * or to an event: a show's rider, stage plot or setlist.
 *
 * One "Add Attachment" button opens the phone's own source menu (camera,
 * library, files); see `chooseSource`. Whatever is picked is named before it
 * uploads: a camera photo otherwise arrives called
 * "photo-2026-10-08-14-02-11.jpg".
 */
export function TaskAttachments({
  boardId,
  parent,
}: {
  boardId: string;
  parent: { taskId: string } | { eventId: string } | { financeEntryId: string };
}) {
  const colors = useThemeColors();
  const { can } = usePermissions();
  const me = useMe(true);
  const attachments = useAttachments(boardId, parent);
  const upload = useUploadAttachment(boardId, parent);
  const remove = useDeleteAttachment(boardId, parent);
  const rename = useRenameAttachment(boardId, parent);
  const [picked, setPicked] = useState<{ source: UploadSource; preview?: string } | null>(null);
  const myId = me.data?.user.id;
  // Whoever manages the parent may rename or delete anyone's upload.
  const manages = can(
    'eventId' in parent
      ? 'event.manage'
      : 'financeEntryId' in parent
        ? 'finance.manage'
        : 'task.editFields',
  );
  const receipts = 'financeEntryId' in parent;
  const heading = receipts ? 'RECEIPTS' : 'ATTACHMENTS';

  const add = async () => {
    try {
      const from = await chooseSource();
      if (!from) return;
      const picked = await pickUpload(from);
      if (picked) setPicked(picked);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not open the picker');
    }
  };

  const files = attachments.data ?? [];

  return (
    <Section title={files.length > 0 ? `${heading} · ${files.length}` : heading}>
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
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          {receipts ? 'No receipt yet.' : 'No files attached.'}
        </PosterText>
      )}

      {upload.isPending && (
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          {`Uploading ${upload.variables?.fileName ?? 'file'}…`}
        </PosterText>
      )}

      {can('file.upload') && (
        <Button
          title={receipts ? 'Add Receipt' : 'Add Attachment'}
          variant="secondary"
          size="sm"
          disabled={upload.isPending}
          onPress={() => void add()}
          style={{ marginTop: spacing.xs }}
        />
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
