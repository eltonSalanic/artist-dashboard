import { FINANCE_COLORS, formatMoney } from '@artist/shared';
import { PosterText } from '@/components/poster-text';
import { useScheme, usePosterCanvas } from '@/theme';

export function FinanceAmount({
  cents,
  currency,
  signed = false,
}: {
  cents: number;
  currency: string;
  signed?: boolean;
}) {
  const colors = FINANCE_COLORS[useScheme()];
  const canvas = usePosterCanvas();
  return (
    <PosterText
      variant="rowTitle"
      color={cents > 0 ? colors.positive : cents < 0 ? colors.negative : canvas.soft}
    >
      {signed && cents > 0 ? '+' : ''}
      {formatMoney(cents, currency)}
    </PosterText>
  );
}
