import { ScrollView, View } from 'react-native';
import { useCustomWidget } from '@artist/api-client';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { noteBlocks } from '../note-preview';
import { shortAgo } from '../format';
import { spacing, useTokens } from '@/theme';

/**
 * The board's note, read-only.
 *
 * Editing is P11, and it is its own phase for a reason: `@tiptap` has no React
 * Native port, so making this editable means bringing in a different bridge to
 * the same ProseMirror core. Reading it needs none of that — the stored
 * document is JSON, and plain text blocks are a faithful enough rendering of
 * what the widget is for.
 */
export function NoteSpoke({ boardId }: { boardId: string }) {
  const tokens = useTokens();
  const note = useCustomWidget(boardId);
  const blocks = noteBlocks(note.data?.content);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, flexGrow: 1 }}
    >
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
          <ThemedText variant="headline">Nothing written yet</ThemedText>
          <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
            The band&apos;s shared note lives here. Editing it on a phone comes later.
          </ThemedText>
        </View>
      ) : (
        <>
          {note.data?.updatedAt && (
            <ThemedText variant="caption" tone="muted">
              EDITED {shortAgo(note.data.updatedAt).toUpperCase()}
            </ThemedText>
          )}
          {blocks.map((block, index) => (
            <ThemedText key={index} variant="body">
              {block}
            </ThemedText>
          ))}
        </>
      )}
    </ScrollView>
  );
}
