import { ScrollView, View } from 'react-native';
import { isMarkdownEditable, type NoteNode } from '@artist/shared';
import { useCustomWidget, usePermissions } from '@artist/api-client';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { PosterText } from '@/components/poster-text';
import { NoteView } from '@/features/notes/note-view';
import { noteBlocks } from '../note-preview';
import { shortAgo } from '../format';
import { SpokeHeader } from '../spoke-header';
import { spacing, useTokens } from '@/theme';

/**
 * The board's note, drawn natively from its TipTap document. Editing is the
 * header's Edit (admins, `widget.manage`), which opens the note form.
 *
 * `noteBlocks` still decides emptiness: a document of empty paragraphs is
 * "nothing written yet", whatever its structure.
 */
export function NoteSpoke({ boardId }: { boardId: string }) {
  const tokens = useTokens();
  const { can } = usePermissions();
  const note = useCustomWidget(boardId);
  const blocks = noteBlocks(note.data?.content);
  const canManage = can('widget.manage');

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
    >
      <SpokeHeader
        boardId={boardId}
        widgetType="CUSTOM"
        summary={note.data?.updatedAt ? `Edited ${shortAgo(note.data.updatedAt)}` : null}
      />
      {note.isPending ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton width="90%" height={16} />
          <Skeleton width="75%" height={16} />
          <Skeleton width="80%" height={16} />
        </View>
      ) : blocks.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          <Icon
            name={{ sf: 'square.and.pencil', md: 'edit-note' }}
            size={28}
            color={tokens.mutedForeground}
          />
          <PosterText variant="title" color={tokens.foreground}>
            Nothing written yet
          </PosterText>
          <PosterText variant="body" color={tokens.mutedForeground} style={{ textAlign: 'center' }}>
            {canManage
              ? "The band's shared note lives here. Tap Edit to write it."
              : "The band's shared note lives here."}
          </PosterText>
        </View>
      ) : (
        <>
          <NoteView doc={note.data!.content as unknown as NoteNode} />
          {canManage && !isMarkdownEditable(note.data!.content) && (
            <PosterText variant="cardMeta" color={tokens.mutedForeground}>
              This note uses formatting the phone can&apos;t edit without losing. Edit it on web.
            </PosterText>
          )}
        </>
      )}
    </ScrollView>
  );
}
