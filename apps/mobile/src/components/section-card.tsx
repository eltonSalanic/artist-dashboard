import type { ReactNode } from 'react';
import { View } from 'react-native';
import { concentric, radius, spacing, useShadows, useTokens } from '@/theme';
import { PosterText } from './poster-text';
import { ThemedText } from './themed-text';

/**
 * A settings group as its own card: a large sentence-case title, an optional
 * caption and description, then the rows or form it holds.
 *
 * `Section` (a small caps caption over flat content) is right on a detail
 * screen, where the groups are short and the item is the subject. A settings
 * screen is seven groups of forms and lists with nothing between them but air,
 * and there the captions were too quiet to tell one group from the next. A
 * card per group puts an edge around each, and the title is set at the size
 * the screen's own title is, so it reads as a heading rather than a label.
 *
 * The corner is concentric with a `Row`'s: the row's radius plus the padding
 * between them, so the two curves stay evenly spaced.
 */
export function SectionCard({
  title,
  caption,
  description,
  action,
  danger = false,
  children,
}: {
  title: string;
  /** At the title's right edge: the one control for the whole group, such as an (i). */
  action?: ReactNode;
  /** Small caps under the title: a count, a state. */
  caption?: string | null;
  description?: string;
  /** Rings the card in the destructive colour: the group that can delete things. */
  danger?: boolean;
  children: ReactNode;
}) {
  const tokens = useTokens();
  const shadows = useShadows();

  return (
    <View
      style={{
        backgroundColor: tokens.card,
        borderRadius: CARD_RADIUS,
        borderCurve: 'continuous',
        padding: spacing.md,
        gap: spacing.xs,
        boxShadow: shadows.card,
      }}
    >
      {/* The danger ring is drawn over the card, not as its border. A 1.5pt
          border is 4.5px at 3x, so it put everything inside on a half pixel:
          iOS then drew a paragraph a hair narrower than Yoga measured it, wrapped
          one line more, and the box cut the last line off. Laid over the card,
          the ring takes no room, and every card's content starts on whole pixels. */}
      {danger && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: CARD_RADIUS,
            borderCurve: 'continuous',
            borderWidth: 1.5,
            borderColor: `${tokens.destructive}59`,
          }}
        />
      )}
      <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ThemedText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
            {title}
          </ThemedText>
          {action}
        </View>
        {caption != null && caption !== '' && (
          <PosterText variant="label" color={tokens.mutedForeground} style={{ marginTop: spacing.xs }}>
            {caption.toUpperCase()}
          </PosterText>
        )}
      </View>
      {description !== undefined && (
        <ThemedText
          variant="footnote"
          tone="muted"
          style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}
        >
          {description}
        </ThemedText>
      )}
      {children}
    </View>
  );
}

/** A `Row`'s corner plus the card's padding, so the two curves share a centre. */
const CARD_RADIUS = concentric(radius.sm, spacing.md);
