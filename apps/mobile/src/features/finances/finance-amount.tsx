import { FINANCE_COLORS, formatMoney } from '@artist/shared';
import { PosterText } from '@/components/poster-text';
import { useScheme, usePosterCanvas } from '@/theme';

export function FinanceAmount({
  cents,
  currency,
  signed = false,
  owed = false,
}: {
  cents: number;
  currency: string;
  signed?: boolean;
  /**
   * What the band owes a member: in the ledger's red but without a minus, which
   * next to their name would read as them owing the band.
   */
  owed?: boolean;
}) {
  const colors = FINANCE_COLORS[useScheme()];
  const canvas = usePosterCanvas();
  return (
    <PosterText
      variant="rowTitle"
      color={
        owed
          ? colors.negative
          : cents > 0
            ? colors.positive
            : cents < 0
              ? colors.negative
              : canvas.soft
      }
    >
      {signed && cents > 0 ? '+' : ''}
      {formatMoney(cents, currency)}
    </PosterText>
  );
}
