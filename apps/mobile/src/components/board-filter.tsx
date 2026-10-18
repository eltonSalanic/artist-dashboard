import { FlatList, Pressable } from 'react-native';
import type { BoardSummaryDto } from '@artist/shared';
import { boardAccent, radius, spacing, useScheme, useThemeColors } from '@/theme';
import { PosterText } from './poster-text';
import { Dot } from './row';

/**
 * All · Neon Harbor · Weekend Duo — the band filter the Calendar and Inbox
 * share.
 *
 * **A single-board account gets that band's chip alone, with no "All".**
 * Bootstrap creates exactly one board, so most people have one, and "All" of
 * one band is a choice that cannot change anything. The lone chip still says
 * whose calendar this is, which is why it stays rather than the whole row
 * going (the user asked for it on the board, 2026-10-07).
 *
 * A scroller rather than a segmented control: the number of bands is unbounded
 * and segments divide the width between them, so five bands would be five
 * unreadable slivers.
 *
 * Set as Spotify's filter chips, like the widget pills on a widget screen:
 * filled grey at rest, filled with ink when selected.
 */
export function BoardFilter({
  boards,
  boardId,
  onSelect,
}: {
  boards: BoardSummaryDto[];
  boardId: string | undefined;
  onSelect: (boardId: string | undefined) => void;
}) {
  const colors = useThemeColors();
  const scheme = useScheme();

  if (boards.length === 0) return null;
  const only = boards.length === 1;

  // `null` is the "All" chip; board ids are strings, so the two cannot collide.
  const chips: (BoardSummaryDto | null)[] = only ? boards : [null, ...boards];

  return (
    <FlatList
      data={chips}
      keyExtractor={(board) => board?.id ?? 'all'}
      horizontal
      showsHorizontalScrollIndicator={false}
      // A ScrollView grows by default, so above the agenda's list it took half
      // the leftover height and stretched every chip into a tall capsule.
      style={{ flexGrow: 0 }}
      contentContainerStyle={{
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
      }}
      renderItem={({ item: board }) => {
        const active =
          only || (board === null ? boardId === undefined : boardId === board.id);
        const accent = board === null ? null : boardAccent(board.palette, scheme);

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={board === null ? 'All bands' : board.name}
            disabled={only}
            onPress={() => onSelect(board?.id)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md - 2,
              paddingVertical: spacing.xs + 3,
              borderRadius: radius.full,
              borderCurve: 'continuous',
              // Selection is carried by the fill and by `accessibilityState`,
              // never by the band's own colour — which is a hue, and two bands
              // may share it.
              backgroundColor: active ? colors.foreground : colors.muted,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {accent !== null && <Dot color={accent.bg} size={8} />}
            {/* One line at a fixed line height (the chip style carries one).
                Measured on its own, a band name's box came out shorter than its
                letters: iOS clips a Text to its box, and the row centred the
                short box, so the name sat low beside its dot with its bottom
                cut off. */}
            <PosterText
              variant="chip"
              numberOfLines={1}
              color={active ? colors.background : colors.foreground}
            >
              {board === null ? 'All' : board.name}
            </PosterText>
          </Pressable>
        );
      }}
    />
  );
}
