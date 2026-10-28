import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useBoard } from '@artist/api-client';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { Skeleton } from '@/components/skeleton';
import {
  posterRadius,
  useShadows,
  spacing,
  usePosterCanvas,
  useThemeColors,
  type WidgetInk,
} from '@/theme';

/**
 * The top of a task, event or goal: one block in the colour of the widget it
 * belongs to, so the screen reads as the calendar block or the widget card you
 * tapped, opened up. A show is the Shows colour, a task its To-Do's.
 *
 * The kind is written in small caps across the top, so the colour never says
 * it alone; `aside` takes the top right ("In 4 days", "Archived"). Above it
 * sits the band's name, so someone in several bands always knows whose item
 * this is, however they reached it.
 */
export function DetailPoster({
  boardId,
  ink,
  label,
  aside,
  title,
  done = false,
  children,
}: {
  boardId: string;
  ink: WidgetInk;
  label: string;
  aside?: string | null;
  title: string;
  /** A finished task or goal: struck through, still legible. */
  done?: boolean;
  /** What follows the title on the block: the when, the status, a button. */
  children?: ReactNode;
}) {
  const shadows = useShadows();
  return (
    <View
      style={{
        backgroundColor: ink.bg,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        padding: spacing.md + 2,
        gap: spacing.sm,
        boxShadow: ink.plain ? shadows.card : shadows.raised,
      }}
    >
      <BandTag boardId={boardId} ink={ink} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <PosterText variant="label" color={ink.ink} style={{ flex: 1 }}>
          {label.toUpperCase()}
        </PosterText>
        {aside ? (
          <PosterText variant="label" color={ink.soft}>
            {aside.toUpperCase()}
          </PosterText>
        ) : null}
      </View>
      <PosterText
        variant="statement"
        color={ink.ink}
        accessibilityRole="header"
        style={done ? { textDecorationLine: 'line-through', opacity: 0.7 } : undefined}
      >
        {title}
      </PosterText>
      {children}
    </View>
  );
}

/**
 * The band an item belongs to, as a filled capsule in the block's ink: the
 * loudest small thing on the block, so it is read before the title. Takes no
 * room until the board has loaded (it almost always has, from the hub).
 */
export function BandTag({ boardId, ink }: { boardId: string; ink: WidgetInk }) {
  const name = useBoard(boardId).data?.name;
  if (!name) return null;
  return (
    <View
      accessibilityLabel={`Band: ${name}`}
      style={{
        alignSelf: 'flex-start',
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: 4,
        paddingHorizontal: spacing.sm + 2,
        borderRadius: posterRadius.chip,
        backgroundColor: ink.ink,
      }}
    >
      <Icon name={{ sf: 'music.note', md: 'music-note' }} size={13} color={ink.bg} />
      <PosterText variant="chip" color={ink.bg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {name}
      </PosterText>
    </View>
  );
}

/** A quieter line on the block: a time, a place, a due date. */
export function PosterMeta({ ink, children }: { ink: WidgetInk; children: string }) {
  return (
    <PosterText variant="body" color={ink.soft}>
      {children}
    </PosterText>
  );
}

/** The block's shape while the item loads, so nothing jumps when it lands. */
export function DetailLoading() {
  const canvas = usePosterCanvas();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: canvas.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      <Skeleton width="100%" height={150} style={{ borderRadius: posterRadius.block }} />
      <Skeleton width="80%" height={16} />
      <Skeleton width="100%" height={60} />
    </ScrollView>
  );
}

/**
 * The item is gone, or is not yours to see. The API answers both with a 404
 * rather than confirming it exists, so this cannot tell them apart either.
 */
export function DetailMissing({ what, reason }: { what: string; reason: string }) {
  const canvas = usePosterCanvas();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.xl,
        backgroundColor: canvas.background,
      }}
    >
      <Icon
        name={{ sf: 'questionmark.circle', md: 'help-outline' }}
        size={30}
        color={canvas.soft}
      />
      <PosterText variant="title" color={canvas.ink}>
        {`${what} not found`}
      </PosterText>
      <PosterText variant="body" color={canvas.soft} style={{ textAlign: 'center' }}>
        {reason}
      </PosterText>
      <Pressable
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => router.back()}
        style={({ pressed }) => ({ padding: spacing.sm, opacity: pressed ? 0.6 : 1 })}
      >
        <PosterText variant="rowTitle" color={canvas.ink}>
          Go back
        </PosterText>
      </Pressable>
    </View>
  );
}

/** "Edit" in the bar, set like the spoke screens' header action. */
export function HeaderEdit({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress}>
      <PosterText variant="rowTitle" color={colors.primary}>
        Edit
      </PosterText>
    </Pressable>
  );
}
