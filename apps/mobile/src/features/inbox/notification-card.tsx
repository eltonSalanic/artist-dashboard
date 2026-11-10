import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import type { MentionNotificationDto } from '@artist/api-client';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import {
  posterRadius,
  spacing,
  useScheme,
  useShadows,
  useThemeColors,
  type SlotHex,
} from '@/theme';
import { MONEY_COLORS } from '@/theme/money-colors';
import { inboxCardContent, inboxWhen } from './present';

/** The dismiss button's box, and how far it sits from the card's corner. */
const DISMISS = 28;
const DISMISS_INSET = spacing.sm + 2;
/** The band's dot in the footer. */
const DOT = 8;

/**
 * One notification as its own card, read top to bottom in three steps: what
 * kind of thing it is and from whom (small caps) with when on the right, then
 * the words that are the reason to open it, set the largest on the card (the
 * comment itself, or what the money was for with its amount), then where it
 * happened.
 *
 * The band is a dot in its own colour *and* its name, so colour never says it
 * alone, and the dot is the only colour on a mention: the old tile put the
 * band's colour behind the person's initial, which read as the person's.
 */
export function NotificationCard({
  item,
  namesBoards,
  accent,
  onDismiss,
}: {
  item: MentionNotificationDto;
  /** The account has more than one band, so each card says which. */
  namesBoards: boolean;
  accent: SlotHex | undefined;
  onDismiss: () => void;
}) {
  const colors = useThemeColors();
  const shadows = useShadows();
  const money = MONEY_COLORS[useScheme()];

  const content = inboxCardContent(item);
  const when = inboxWhen(item.createdAt);
  const band = namesBoards && item.boardName !== '' ? item.boardName : null;
  // Money that came to you is the app's "money in" green. Money still owed to
  // someone is pending, not lost, so it stays ink rather than turning red.
  const tint = content.kind === 'Paid back' ? money.positive : colors.foreground;

  // A payback opens its expense, where an admin pays it back. One alert for
  // several expenses has no single entry, so it opens Finances.
  const href =
    item.kind === 'MENTION' && item.taskId
      ? `/board/${item.boardId}/task/${item.taskId}`
      : item.entryId
        ? `/board/${item.boardId}/form/finance?id=${item.entryId}`
        : `/board/${item.boardId}/w/FINANCES`;

  return (
    // The two buttons are siblings, not nested: a button inside a button is
    // one element to VoiceOver, and the dismiss would be unreachable.
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[content.sentence, band, when].filter(Boolean).join('. ')}
        // Opening leaves the card in place, matching web: it clears when the
        // person clears it, so a glance at the task does not lose the reminder.
        onPress={() => router.push(href)}
        style={({ pressed }) => ({
          backgroundColor: colors.card,
          borderRadius: posterRadius.block,
          borderCurve: 'continuous',
          boxShadow: shadows.card,
          padding: spacing.md,
          gap: spacing.sm,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            // Room for the dismiss button, which sits over this corner.
            marginRight: DISMISS_INSET + DISMISS - spacing.md + spacing.xs,
          }}
        >
          <PosterText
            variant="label"
            color={colors.foreground}
            numberOfLines={1}
            style={{ flex: 1, minWidth: 0 }}
          >
            {/* The kind is the quiet half: the person is who you look for. */}
            <PosterText
              variant="label"
              color={content.kind === 'Paid back' ? tint : colors.mutedForeground}
            >
              {content.kind.toUpperCase()}
            </PosterText>
            {`  ·  ${item.actorName.toUpperCase()}`}
          </PosterText>
          <PosterText variant="cardMeta" color={colors.mutedForeground} numberOfLines={1}>
            {when}
          </PosterText>
        </View>

        <View style={{ gap: spacing.xs }}>
          {content.amount === null ? (
            <PosterText variant="prose" color={colors.foreground} numberOfLines={3}>
              {content.lead}
            </PosterText>
          ) : (
            // Baseline, so a label that wraps keeps the amount on its first line.
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
              <PosterText
                variant="prose"
                color={colors.foreground}
                numberOfLines={2}
                style={{ flex: 1, minWidth: 0 }}
              >
                {content.lead}
              </PosterText>
              <PosterText
                variant="title"
                color={tint}
                numberOfLines={1}
                style={{ flexShrink: 0, fontVariant: ['tabular-nums'] }}
              >
                {content.amount}
              </PosterText>
            </View>
          )}
          {content.detail !== null && (
            <PosterText variant="cardMeta" color={colors.mutedForeground} numberOfLines={2}>
              {content.detail}
            </PosterText>
          )}
        </View>

        {(band !== null || content.task !== null) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
            {band !== null && (
              <View
                style={{
                  width: DOT,
                  height: DOT,
                  borderRadius: DOT / 2,
                  backgroundColor: accent?.bg ?? colors.mutedForeground,
                }}
              />
            )}
            <PosterText
              variant="meta"
              color={colors.mutedForeground}
              numberOfLines={1}
              style={{ flex: 1, minWidth: 0 }}
            >
              {band !== null && (
                <PosterText variant="meta" color={colors.foreground}>
                  {band}
                </PosterText>
              )}
              {band !== null && content.task !== null ? '  ·  ' : ''}
              {content.task ?? ''}
            </PosterText>
          </View>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          item.kind === 'MENTION'
            ? `Dismiss mention from ${item.actorName}`
            : `Dismiss ${item.kind === 'PAYBACK' ? 'payback reminder' : 'paid back note'} from ${item.actorName}`
        }
        // 28 + 8 either side: a 44pt target without a 44pt hole in the card.
        hitSlop={(44 - DISMISS) / 2}
        onPress={onDismiss}
        style={({ pressed }) => ({
          position: 'absolute',
          top: DISMISS_INSET,
          right: DISMISS_INSET,
          width: DISMISS,
          height: DISMISS,
          borderRadius: posterRadius.chip,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.4 : 1,
        })}
      >
        <Icon name={{ sf: 'xmark', md: 'close' }} size={13} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}
