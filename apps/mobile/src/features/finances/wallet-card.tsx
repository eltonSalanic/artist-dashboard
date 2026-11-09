import { type TextStyle, View } from 'react-native';
import { FINANCE_COLORS, formatMoney } from '@artist/shared';
import { Icon, type IconName } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { useWidgetInk } from '@/features/board/spoke-header';
import { radius, spacing, useScheme, useShadows, useTokens } from '@/theme';
import { Segmented, type Segment } from './wallet-ui';

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
  // greens and reds. A coloured card takes the bright ones with a solid black
  // drop shadow, so they stand off whatever colour the card is.
  const flipped = FINANCE_COLORS[scheme === 'light' ? 'dark' : 'light'];
  const card = widget.plain
    ? {
        bg: tokens.foreground,
        ink: tokens.background,
        soft: `${tokens.background}b3`,
        faint: `${tokens.background}1f`,
        pos: flipped.positive,
        neg: flipped.negative,
        shadow: undefined,
      }
    : {
        bg: widget.bg,
        ink: widget.ink,
        soft: widget.soft,
        faint: `${widget.ink}1f`,
        pos: FINANCE_COLORS.dark.positive,
        neg: FINANCE_COLORS.dark.negative,
        shadow: DROP_SHADOW,
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
          shadow={card.shadow}
          card={card}
        />
        <Figure
          label="Money out"
          icon={{ sf: 'arrow.up.right', md: 'north-east' }}
          value={expenseCents > 0 ? `−${money(expenseCents)}` : money(0)}
          color={card.neg}
          shadow={card.shadow}
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
          shadow={netCents !== 0 ? card.shadow : undefined}
          card={card}
          divided
        />
      </View>
    </View>
  );
}

/** Behind a green or red figure on a coloured card: solid black, down and to the left. */
const DROP_SHADOW: TextStyle = {
  textShadowColor: '#000000',
  textShadowOffset: { width: -2, height: 2 },
  textShadowRadius: 0,
};

function Figure({
  label,
  icon,
  value,
  color,
  shadow,
  card,
  divided = false,
}: {
  label: string;
  icon: IconName;
  value: string;
  color: string;
  /** On a coloured card, the shadow behind a green or red figure so it reads. */
  shadow?: TextStyle;
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
        style={[{ fontVariant: ['tabular-nums'] }, shadow]}
      >
        {value}
      </PosterText>
    </View>
  );
}
