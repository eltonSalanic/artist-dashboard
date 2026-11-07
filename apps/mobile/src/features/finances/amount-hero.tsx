import { useState, type Ref } from 'react';
import { View } from 'react-native';
import type { FinanceKind } from '@artist/shared';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { TextInput } from '@/components/text-input';
import { DISPLAY_SCALE, face, poster, radius, spacing, useTokens } from '@/theme';
import { Segmented } from './wallet-ui';

const AMOUNT = {
  fontFamily: face.black,
  fontSize: 56,
  letterSpacing: -2.2,
  fontVariant: ['tabular-nums' as const],
};

/**
 * The top of the add/edit entry form, as a payments app sets it: whether it's
 * money out or in, then the amount in huge type, centred, then a line for what
 * it was for. The amount is the one thing every entry needs, so it's the first
 * thing on the screen and the field the keyboard opens on.
 */
export function AmountHero({
  kind,
  onKind,
  amount,
  onAmount,
  description,
  onDescription,
  currency,
  editable,
  error,
  autoFocus,
  ref,
}: {
  kind: FinanceKind;
  /** Null once the entry exists: an expense can't turn into income. */
  onKind: ((kind: FinanceKind) => void) | null;
  amount: string;
  onAmount: (text: string) => void;
  description: string;
  onDescription: (text: string) => void;
  currency: string;
  editable: boolean;
  error?: string | null;
  autoFocus?: boolean;
  ref?: Ref<TextInput>;
}) {
  const tokens = useTokens();
  // The input is as wide as what's typed, so "$" stays snug against it and the
  // pair stays centred: measured off an invisible copy of the same text.
  const [width, setWidth] = useState(0);
  const shown = amount === '' ? '0.00' : amount;
  const failed = error != null && error !== '';
  const symbol = currency === 'USD' ? '$' : `${currency} `;

  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xs }}>
      {onKind ? (
        <View style={{ alignSelf: 'stretch', paddingHorizontal: spacing.xl }}>
          <Segmented<FinanceKind>
            label="Type"
            value={kind}
            onChange={onKind}
            options={[
              { value: 'EXPENSE', label: 'Expense' },
              { value: 'INCOME', label: 'Income' },
            ]}
          />
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.md - 2,
            paddingVertical: spacing.xs + 1,
            borderRadius: radius.full,
            backgroundColor: tokens.muted,
          }}
        >
          <Icon
            name={
              kind === 'INCOME'
                ? { sf: 'arrow.down.left', md: 'south-west' }
                : { sf: 'arrow.up.right', md: 'north-east' }
            }
            size={13}
            color={tokens.foreground}
          />
          <PosterText variant="chip" color={tokens.foreground}>
            {kind === 'INCOME' ? 'Income' : 'Expense'}
          </PosterText>
        </View>
      )}

      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <PosterText
            variant="title"
            color={tokens.mutedForeground}
            style={{ fontSize: 30, lineHeight: 36, marginTop: 10, marginRight: 2 }}
          >
            {symbol}
          </PosterText>
          <PosterText
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            maxFontSizeMultiplier={DISPLAY_SCALE}
            onLayout={(e) => setWidth(Math.ceil(e.nativeEvent.layout.width))}
            variant="figure"
            color="transparent"
            style={[AMOUNT, { position: 'absolute', left: 0, top: 0, opacity: 0 }]}
          >
            {shown}
          </PosterText>
          <TextInput
            ref={ref}
            accessibilityLabel={`Amount in ${currency}, required`}
            value={amount}
            onChangeText={onAmount}
            editable={editable}
            autoFocus={autoFocus}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={tokens.mutedForeground}
            maxFontSizeMultiplier={DISPLAY_SCALE}
            selectionColor={tokens.foreground}
            style={[
              AMOUNT,
              {
                color: failed ? tokens.destructive : tokens.foreground,
                width: width ? width + 8 : undefined,
                minWidth: 60,
                maxWidth: 300,
                padding: 0,
                height: 66,
                textAlign: 'center',
                // The browser's focus ring around a borderless number reads as a box.
                outlineColor: 'transparent',
              },
            ]}
          />
        </View>
        {failed ? (
          <PosterText variant="meta" color={tokens.destructive} accessibilityRole="alert">
            {error}
          </PosterText>
        ) : (
          <PosterText variant="meta" color={tokens.mutedForeground}>
            {currency}
          </PosterText>
        )}
      </View>

      <TextInput
        accessibilityLabel="What for"
        value={description}
        onChangeText={onDescription}
        editable={editable}
        placeholder={
          kind === 'INCOME' ? 'What for? Door split, merch…' : 'What for? New strings, van gas…'
        }
        placeholderTextColor={tokens.mutedForeground}
        maxLength={2000}
        multiline
        // Multiline so a long one wraps; on the web that is a textarea, which
        // opens two rows tall unless told otherwise.
        numberOfLines={process.env.EXPO_OS === 'web' ? 1 : undefined}
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        maxFontSizeMultiplier={DISPLAY_SCALE}
        style={[
          poster.title,
          {
            alignSelf: 'stretch',
            textAlign: 'center',
            color: tokens.foreground,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 2,
            borderRadius: radius.full,
            backgroundColor: tokens.muted,
            minHeight: 48,
            outlineColor: 'transparent',
          },
        ]}
      />
    </View>
  );
}
