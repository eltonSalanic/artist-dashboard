import { View } from 'react-native';
import { formatMoney } from '@artist/shared';
import { Icon, type IconName } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { useWidgetInk } from '@/features/board/spoke-header';
import { radius, spacing, useScheme, useShadows, useTokens } from '@/theme';
import { Segmented, type Segment } from './wallet-ui';
import { MONEY_COLORS } from '@/theme/money-colors';

export type Period = 'month' | 'year' | 'all';

export const PERIODS: Segment<Period>[] = [
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

/**
 * The band's money as a bank card: the band fund in big type, the one number
 * everyone wants first, then what came in, went out and the difference over
 * the period picked right on the card.
 *
 * Painted in the Finances widget's colour when the band gave it one, and
 * otherwise as an inverted card (charcoal on cream, cream in the dark), so it
 * reads as the one object on the page.
 */
export function WalletCard({
  boardId,
  currency,
  bandFundCents,
  incomeCents,
  expenseCents,
  netCents,
  period,
  onPeriod,
}: {
  boardId: string;
  currency: string;
  bandFundCents: number;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  period: Period;
  onPeriod: (period: Period) => void;
}) {
  const tokens = useTokens();
  const shadows = useShadows();
  const scheme = useScheme();
  const widget = useWidgetInk(boardId, 'FINANCES');
  // An inverted card sits in the other scheme, so it takes that scheme's
  // greens and reds. A coloured card takes a slightly deeper green and red.
  const flipped = MONEY_COLORS[scheme === 'light' ? 'dark' : 'light'];
  const card = widget.plain
    ? {
        bg: tokens.foreground,
        ink: tokens.background,
        soft: `${tokens.background}b3`,
        faint: `${tokens.background}1f`,
        pos: flipped.positive,
        neg: flipped.negative,
      }
    : {
        bg: widget.bg,
        ink: widget.ink,
        soft: widget.soft,
        faint: `${widget.ink}1f`,
        pos: MONEY_COLORS.onColor.positive,
        neg: MONEY_COLORS.onColor.negative,
      };
  const below = bandFundCents < 0;
  const money = (cents: number) => formatMoney(cents, currency);

  return (
    <View
      accessible
      accessibilityLabel={`Band fund ${money(bandFundCents)}. ${PERIODS.find((p) => p.value === period)?.label}: in ${money(incomeCents)}, out ${money(expenseCents)}, net ${money(netCents)}.`}
      style={{
        backgroundColor: card.bg,
        borderRadius: radius.xl + 4,
        borderCurve: 'continuous',
        padding: spacing.md + 4,
        gap: spacing.md,
        overflow: 'hidden',
        boxShadow: shadows.raised,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <PosterText
          variant="figure"
          color={card.ink}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontSize: 46, lineHeight: 52, letterSpacing: -1.8 }}
        >
          {below ? `−${money(-bandFundCents)}` : money(bandFundCents)}
        </PosterText>
        {below && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.full,
                backgroundColor: card.neg,
              }}
            >
              <PosterText variant="meta" color={card.bg}>
                Below zero
              </PosterText>
            </View>
          </View>
        )}
      </View>

      <Segmented
        label="Period"
        size="sm"
        options={PERIODS}
        value={period}
        onChange={onPeriod}
        ink={{ track: card.faint, thumb: card.ink, label: card.soft, activeLabel: card.bg }}
      />

      <View style={{ flexDirection: 'row' }}>
        <Figure
          label="Money in"
          icon={{ sf: 'arrow.down.left', md: 'south-west' }}
          value={incomeCents > 0 ? `+${money(incomeCents)}` : money(0)}
          color={card.pos}
          card={card}
        />
        <Figure
          label="Money out"
          icon={{ sf: 'arrow.up.right', md: 'north-east' }}
          value={expenseCents > 0 ? `−${money(expenseCents)}` : money(0)}
          color={card.neg}
          card={card}
          divided
        />
        <Figure
          label="Net"
          icon={{ sf: 'equal', md: 'drag-handle' }}
          value={
            netCents > 0 ? `+${money(netCents)}` : netCents < 0 ? `−${money(-netCents)}` : money(0)
          }
          color={netCents > 0 ? card.pos : netCents < 0 ? card.neg : card.ink}
          card={card}
          divided
        />
      </View>
    </View>
  );
}

function Figure({
  label,
  icon,
  value,
  color,
  card,
  divided = false,
}: {
  label: string;
  icon: IconName;
  value: string;
  color: string;
  card: { ink: string; soft: string; faint: string };
  divided?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        gap: 4,
        paddingLeft: divided ? spacing.sm + 2 : 0,
        borderLeftWidth: divided ? 1 : 0,
        borderLeftColor: card.faint,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name={icon} size={12} color={card.soft} />
        <PosterText variant="meta" color={card.soft} numberOfLines={1}>
          {label}
        </PosterText>
      </View>
      <PosterText
        variant="rowTitle"
        color={color}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </PosterText>
    </View>
  );
}
