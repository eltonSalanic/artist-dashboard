import { View } from 'react-native';
import { type PaybackStatus } from '@artist/shared';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { radius, spacing, useScheme, useShadows, useTokens } from '@/theme';
import { PaybackLabel } from './payback-label';
import { MONEY_COLORS } from '@/theme/money-colors';

/**
 * An out-of-pocket expense's payback, shown the way a bank shows a transfer:
 * the amount and who it goes to, a status pill, and two steps (they paid, the
 * band pays them back) with the second one waiting or done. The action that
 * moves it on sits right in the card.
 */
export function PaybackTransfer({
  status,
  amount,
  headline,
  paidStep,
  backStep,
  note,
  action,
}: {
  status: PaybackStatus;
  /** "$32.99" */
  amount: string;
  /** "The band owes Jamie Torres" / "Paid back to Jamie Torres" */
  headline: string;
  /** Step one: who paid, and when. */
  paidStep: { title: string; meta: string };
  /** Step two: the payback, waiting or done. */
  backStep: { title: string; meta: string };
  /** A quieter line under the steps: why it's locked. */
  note?: string | null;
  action?:
    | { kind: 'pay'; label: string; hint: string; disabled: boolean; onPress: () => void }
    | { kind: 'undo'; disabled: boolean; onPress: () => void }
    | null;
}) {
  const tokens = useTokens();
  const shadows = useShadows();
  const finance = MONEY_COLORS[useScheme()];
  const done = status === 'paid';

  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: tokens.card,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        padding: spacing.md + 2,
        gap: spacing.md,
        boxShadow: shadows.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon
          name={{ sf: 'arrow.left.arrow.right', md: 'swap-horiz' }}
          size={16}
          color={tokens.mutedForeground}
        />
        <PosterText variant="label" color={tokens.mutedForeground} style={{ flex: 1 }}>
          PAYBACK
        </PosterText>
        <PaybackLabel status={status} />
      </View>

      <View style={{ gap: 2 }}>
        <PosterText variant="cardMeta" color={tokens.mutedForeground}>
          {headline}
        </PosterText>
        <PosterText
          variant="stat"
          color={done ? finance.positive : finance.negative}
          style={{ fontSize: 30, lineHeight: 36 }}
        >
          {amount}
        </PosterText>
      </View>

      <View>
        <Step done title={paidStep.title} meta={paidStep.meta} line />
        <Step done={done} title={backStep.title} meta={backStep.meta} />
      </View>

      {note ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <Icon name={{ sf: 'lock.fill', md: 'lock' }} size={14} color={tokens.mutedForeground} />
          <PosterText variant="cardMeta" color={tokens.mutedForeground} style={{ flex: 1 }}>
            {note}
          </PosterText>
        </View>
      ) : null}

      {action?.kind === 'pay' && (
        <View style={{ gap: spacing.xs }}>
          <Button title={action.label} disabled={action.disabled} onPress={action.onPress} />
          <PosterText
            variant="cardMeta"
            color={tokens.mutedForeground}
            style={{ textAlign: 'center' }}
          >
            {action.hint}
          </PosterText>
        </View>
      )}
      {action?.kind === 'undo' && (
        <Button
          title="Undo pay back"
          variant="secondary"
          size="sm"
          disabled={action.disabled}
          onPress={action.onPress}
        />
      )}
    </View>
  );
}

/** One step of the transfer: a dot (filled when done), a line down to the next. */
function Step({
  done,
  title,
  meta,
  line = false,
}: {
  done: boolean;
  title: string;
  meta: string;
  line?: boolean;
}) {
  const tokens = useTokens();
  const green = MONEY_COLORS[useScheme()].positive;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm + 4 }}>
      <View style={{ width: 22, alignItems: 'center' }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.full,
            borderWidth: done ? 0 : 2,
            borderColor: tokens.mutedForeground,
            backgroundColor: done ? green : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {done && <Icon name={{ sf: 'checkmark', md: 'check' }} size={13} color="#ffffff" />}
        </View>
        {line && (
          <View
            style={{
              flex: 1,
              width: 2,
              minHeight: 14,
              marginVertical: 3,
              backgroundColor: done ? green : tokens.border,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 1, paddingBottom: line ? spacing.md : 0 }}>
        <PosterText variant="rowTitle" color={tokens.foreground}>
          {title}
        </PosterText>
        <PosterText variant="cardMeta" color={tokens.mutedForeground}>
          {meta}
        </PosterText>
      </View>
    </View>
  );
}
