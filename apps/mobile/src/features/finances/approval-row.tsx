import { useRef } from "react";
import { View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import {
  categoryLabel,
  formatMoney,
  type FinanceEntryDto,
} from "@artist/shared";
import { Icon } from "@/components/icon";
import { PosterText } from "@/components/poster-text";
import { Row } from "@/components/row";
import { radius, spacing, useThemeColors } from "@/theme";
import { shortAgo, shortDate } from "../board/format";

const DAY = 24 * 60 * 60 * 1000;
/** Past this, an unanswered request is called out in the row. */
const STALE_DAYS = 7;

/**
 * One expense waiting for an admin, with what they need to decide on it
 * without opening it: who paid, for which show, their note, whether there is
 * a receipt, and how long it has been waiting.
 *
 * Admins swipe it: right to approve, left to send it back (which opens the
 * note form, since a rejection without a reason helps nobody). The same two
 * actions are on the entry itself, and as accessibility actions here, so the
 * swipe is a shortcut rather than the only way.
 */
export function ApprovalRow({
  entry,
  currency,
  first,
  who,
  canDecide,
  onOpen,
  onApprove,
  onSendBack,
}: {
  entry: FinanceEntryDto;
  currency: string;
  first: boolean;
  who: string;
  canDecide: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onSendBack: () => void;
}) {
  const colors = useThemeColors();
  const swipeable = useRef<SwipeableMethods>(null);
  const waitedMs = Date.now() - new Date(entry.createdAt).getTime();
  const stale = waitedMs >= STALE_DAYS * DAY;

  const meta = [
    `${who} paid · ${shortDate(`${entry.occurredOn}T12:00:00`)}`,
    entry.eventTitle,
    entry.note,
  ]
    .filter((part): part is string => !!part)
    .join(" · ");

  const row = (
    <Row
      first={first}
      title={entry.description || categoryLabel(entry.category)}
      meta={meta}
      lead={
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.muted,
          }}
          accessibilityLabel={
            entry.receiptCount > 0 ? "Has a receipt" : "No receipt"
          }
        >
          <Icon
            name={
              entry.receiptCount > 0
                ? { sf: "doc.text", md: "receipt-long" }
                : { sf: "doc", md: "receipt" }
            }
            size={18}
            color={
              entry.receiptCount > 0
                ? colors.foreground
                : colors.mutedForeground
            }
          />
        </View>
      }
      trailing={
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <PosterText variant="rowTitle" color={colors.foreground}>
            {formatMoney(entry.amountCents, currency)}
          </PosterText>
          <PosterText
            variant="cardMeta"
            color={stale ? colors.destructive : colors.mutedForeground}
          >
            {stale
              ? `waiting ${shortAgo(entry.createdAt)}`
              : shortAgo(entry.createdAt)}
          </PosterText>
        </View>
      }
      onPress={onOpen}
      accessibilityActions={
        canDecide
          ? [
              { name: "approve", label: "Approve" },
              { name: "sendBack", label: "Send back" },
            ]
          : undefined
      }
      onAccessibilityAction={(name) => {
        if (name === "approve") onApprove();
        if (name === "sendBack") onSendBack();
      }}
    />
  );

  if (!canDecide) return row;

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={64}
      rightThreshold={64}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <SwipeAction
          label="Approve"
          icon={{ sf: "checkmark", md: "check" }}
          tone="approve"
        />
      )}
      renderRightActions={() => (
        <SwipeAction
          label="Send back"
          icon={{ sf: "arrow.uturn.backward", md: "undo" }}
          tone="sendBack"
        />
      )}
      onSwipeableOpen={(direction) => {
        // `direction` is the way the row moved, not the side that opened: a
        // swipe to the right reveals the left actions (Approve) and reports
        // "right". The row springs back either way: approving removes it from
        // the list, and sending back hands off to the note form.
        swipeable.current?.close();
        if (direction === "right") onApprove();
        else onSendBack();
      }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

function SwipeAction({
  label,
  icon,
  tone,
}: {
  label: string;
  icon: { sf: "checkmark" | "arrow.uturn.backward"; md: "check" | "undo" };
  tone: "approve" | "sendBack";
}) {
  const colors = useThemeColors();
  const bg = tone === "approve" ? colors.primary : colors.destructive;
  // Both fills are saturated; the primary's label reads on either.
  const fg = colors.primaryForeground;
  return (
    <View
      style={{
        width: 112,
        marginVertical: spacing.xs,
        borderRadius: radius.md,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Icon name={icon} size={18} color={fg} />
      <PosterText variant="cardMeta" color={fg}>
        {label}
      </PosterText>
    </View>
  );
}
