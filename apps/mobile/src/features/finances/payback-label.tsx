import { View } from "react-native";
import {
  FINANCE_COLORS,
  PAYBACK_LABELS,
  type PaybackStatus,
} from "@artist/shared";
import { PosterText } from "@/components/poster-text";
import { radius, spacing, useScheme } from "@/theme";

/**
 * "Owed back" or "Paid back" on an expense a member paid out of pocket, in the
 * ledger's own red and green so it reads at a glance in a long list.
 */
export function PaybackLabel({ status }: { status: PaybackStatus }) {
  const colors = FINANCE_COLORS[useScheme()];
  const color = status === "paid" ? colors.positive : colors.negative;
  return (
    <View
      accessibilityLabel={PAYBACK_LABELS[status]}
      style={{
        alignSelf: "flex-end",
        // The ink at a low alpha: a tint of itself on either canvas.
        backgroundColor: `${color}1f`,
        borderRadius: radius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <PosterText variant="meta" color={color}>
        {PAYBACK_LABELS[status]}
      </PosterText>
    </View>
  );
}
