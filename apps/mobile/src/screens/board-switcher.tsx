import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { useCreateBoard } from '@artist/api-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { useSelectedBoard } from '@/features/board/selected-board';
import {
  boardAccent,
  posterInput,
  posterRadius,
  spacing,
  usePosterCanvas,
  useScheme,
  useTokens,
} from '@/theme';

/**
 * The board switcher, reached by tapping the board name in the header — the
 * Slack/Notion/Linear convention, which needs no teaching. It is deliberately
 * not a tab: mixing a mode switch into a content tab strip breaks what the
 * strip teaches, and the rightmost item of a strip is both hardest to reach and
 * first to disappear.
 *
 * Each band is a block in its own colour, as the band is on the You tab, so the
 * sheet reads as the wall of bands you can step into. The one you are in has a
 * filled tick; two bands can share a colour, so the tick and the name say which
 * is which, never the colour alone.
 *
 * Below the bands, "Create a band" opens a name field in place: the sheet
 * stays put rather than dismissing and pushing a form, which is the sequence
 * that half-drew Settings from the board menu (react-native-screens#4651).
 */
export function BoardSwitcherSheet() {
  const canvas = usePosterCanvas();
  const scheme = useScheme();
  const { boards, board, select } = useSelectedBoard();
  // `?create=1` (from the no-band screen) opens with the name field ready.
  const { create } = useLocalSearchParams<{ create?: string }>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  return (
    // The sheet's header is drawn over its content, so the content steps
    // below it with padding. This was a ScrollView inset natively for the
    // header, and the native inset is invisible to React Native's own layout:
    // each row's press area sat a header's height above the row
    // (react-native#43546). A row lit up on touch, but a release the press area
    // thought was outside it was dropped, so most taps never switched band.
    <View
      style={{
        backgroundColor: canvas.background,
        padding: spacing.md,
        paddingTop: headerHeight + spacing.sm,
        paddingBottom: spacing.md + insets.bottom,
        gap: spacing.sm,
      }}
    >
      {boards.map((candidate) => {
        const current = candidate.id === board?.id;
        const accent = boardAccent(candidate.palette, scheme);
        return (
          <Pressable
            key={candidate.id}
            accessibilityRole="button"
            accessibilityLabel={`${candidate.name}, ${candidate.role.toLowerCase()}`}
            accessibilityState={{ selected: current }}
            onPress={() => {
              select(candidate.id);
              router.back();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md - 4,
              padding: spacing.md - 2,
              minHeight: 64,
              borderRadius: posterRadius.block,
              borderCurve: 'continuous',
              backgroundColor: accent.bg,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{ flex: 1, gap: spacing.xs }}>
              <PosterText variant="title" color={accent.fg} numberOfLines={2}>
                {candidate.name}
              </PosterText>
              <PosterText variant="label" color={accent.fg}>
                {current ? `${candidate.role} · SHOWING` : candidate.role}
              </PosterText>
            </View>
            {/* A ring for the others, so the row's right edge is the same
                shape on every block and the filled one stands out. */}
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 2,
                borderColor: accent.fg,
                backgroundColor: current ? accent.fg : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {current && (
                <Icon name={{ sf: 'checkmark', md: 'check' }} size={13} color={accent.bg} />
              )}
            </View>
          </Pressable>
        );
      })}
      <CreateBand
        startOpen={create === '1'}
        onCreated={(id) => {
          select(id);
          router.back();
        }}
      />
    </View>
  );
}

function CreateBand({
  startOpen = false,
  onCreated,
}: {
  startOpen?: boolean;
  onCreated: (boardId: string) => void;
}) {
  const tokens = useTokens();
  const create = useCreateBoard();
  const [open, setOpen] = useState(startOpen);
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed, { onSuccess: (board) => onCreated(board.id) });
  };

  const block = {
    minHeight: 64,
    borderRadius: posterRadius.block,
    borderCurve: 'continuous' as const,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: tokens.mutedForeground,
  };

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create a band"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          ...block,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md - 2,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Icon name={{ sf: 'plus', md: 'add' }} size={17} color={tokens.foreground} />
        <PosterText variant="cardTitle" color={tokens.foreground}>
          Create a band
        </PosterText>
      </Pressable>
    );
  }

  return (
    <View style={{ ...block, padding: spacing.md - 2, gap: spacing.sm }}>
      <PosterText variant="label" color={tokens.mutedForeground}>
        NEW BAND · YOU&apos;LL BE ITS ADMIN
      </PosterText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          accessibilityLabel="Band name"
          autoFocus
          placeholder="Band name"
          placeholderTextColor={tokens.mutedForeground}
          maxLength={80}
          returnKeyType="done"
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          style={[
            posterInput,
            {
              flex: 1,
              color: tokens.foreground,
              backgroundColor: tokens.muted,
              borderRadius: posterRadius.block,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
            },
          ]}
        />
        {create.isPending ? (
          <ActivityIndicator />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create band"
            disabled={!name.trim()}
            hitSlop={10}
            onPress={submit}
          >
            <PosterText
              variant="chip"
              color={name.trim() ? tokens.primary : tokens.mutedForeground}
            >
              Create
            </PosterText>
          </Pressable>
        )}
      </View>
    </View>
  );
}
