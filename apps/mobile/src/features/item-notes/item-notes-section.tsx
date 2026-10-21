import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { NoteParentKind } from '@artist/shared';
import { useNotes } from '@artist/api-client';
import { PosterText } from '@/components/poster-text';
import { Section } from '@/components/section';
import { posterRadius, spacing, useThemeColors, useTokens } from '@/theme';

/** Where a note's editor lives: the shared form route, kind `item-note`. */
export const noteFormHref = (
  boardId: string,
  kind: NoteParentKind,
  parentId: string,
  noteId?: string,
) =>
  `/board/${boardId}/form/item-note?on=${kind}&parentId=${parentId}${noteId ? `&id=${noteId}` : ''}` as const;

/**
 * The titled notes on a task, event, goal or reminder, each a block with its
 * title and text. A tap opens it to edit (for whoever may edit the item);
 * "Add" starts a new one. Hidden entirely for a reader when there are none.
 */
export function ItemNotesSection({
  boardId,
  kind,
  parentId,
  canEdit,
}: {
  boardId: string;
  kind: NoteParentKind;
  parentId: string;
  canEdit: boolean;
}) {
  const colors = useThemeColors();
  const tokens = useTokens();
  const notes = useNotes(boardId, kind, parentId);
  const list = notes.data ?? [];

  if (!canEdit && list.length === 0) return null;

  return (
    <Section
      title={list.length > 0 ? `NOTES · ${list.length}` : 'NOTES'}
      action={
        canEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add note"
            hitSlop={10}
            onPress={() => router.push(noteFormHref(boardId, kind, parentId))}
          >
            <PosterText variant="chip" color={colors.primary}>
              Add
            </PosterText>
          </Pressable>
        ) : undefined
      }
    >
      {list.length === 0 && !notes.isPending && (
        <PosterText variant="cardMeta" color={tokens.mutedForeground}>
          No notes yet. Tap Add to write one.
        </PosterText>
      )}
      <View style={{ gap: spacing.sm }}>
        {list.map((note) => (
          <Pressable
            key={note.id}
            accessibilityRole={canEdit ? 'button' : undefined}
            accessibilityHint={canEdit ? 'Opens the note to edit' : undefined}
            disabled={!canEdit}
            onPress={() => router.push(noteFormHref(boardId, kind, parentId, note.id))}
            style={({ pressed }) => ({
              backgroundColor: tokens.muted,
              borderRadius: posterRadius.block,
              borderCurve: 'continuous',
              padding: spacing.md,
              gap: spacing.xs,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <PosterText variant="cardTitle" color={tokens.foreground}>
              {note.title}
            </PosterText>
            {note.body.trim() !== '' && (
              <PosterText variant="paragraph" color={tokens.foreground}>
                {note.body}
              </PosterText>
            )}
          </Pressable>
        ))}
      </View>
    </Section>
  );
}
