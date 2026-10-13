import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { radius, spacing, useTokens } from '@/theme';
import { Icon } from './icon';
import { ThemedText } from './themed-text';

export interface PickOption {
  value: string;
  label: string;
  /** A quieter second line: a date, a period. */
  meta?: string | null;
}

/**
 * One choice from a list too long for chips — a band's goals, its upcoming
 * shows. Closed it is one row saying what is chosen; tapped it opens in place
 * into the options, and a pick closes it again.
 *
 * In place rather than a picker sheet: the forms are modals, and a sheet over
 * a modal is a second layer to dismiss for what is one tap.
 *
 * `null` is "none", offered first as `noneLabel`.
 */
export function PickOne({
  label,
  noneLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  noneLabel: string;
  options: PickOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const tokens = useTokens();
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value) ?? null;

  const all: (PickOption | { value: null; label: string; meta?: undefined })[] = [
    { value: null, label: noneLabel },
    ...options,
  ];

  return (
    <View style={{ gap: spacing.xs }}>
      <ThemedText variant="footnote" tone="muted" style={{ fontWeight: '600' }}>
        {label}
      </ThemedText>
      <View
        style={{
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: tokens.muted,
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${chosen?.label ?? noneLabel}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((was) => !was)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: 44,
            paddingHorizontal: spacing.md,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <ThemedText
            variant="body"
            numberOfLines={1}
            tone={chosen ? undefined : 'muted'}
            style={{ flex: 1 }}
          >
            {chosen?.label ?? noneLabel}
          </ThemedText>
          <Icon
            name={
              open
                ? { sf: 'chevron.up', md: 'expand-less' }
                : { sf: 'chevron.down', md: 'expand-more' }
            }
            size={13}
            color={tokens.mutedForeground}
          />
        </Pressable>

        {open && (
          <View accessibilityRole="radiogroup" accessibilityLabel={label}>
            {all.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value ?? '__none'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    minHeight: 44,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderTopWidth: 1,
                    borderTopColor: tokens.border,
                    backgroundColor: pressed ? tokens.accent : undefined,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText
                      variant="body"
                      numberOfLines={2}
                      tone={option.value === null ? 'muted' : undefined}
                    >
                      {option.label}
                    </ThemedText>
                    {option.meta ? (
                      <ThemedText variant="footnote" tone="muted" numberOfLines={1}>
                        {option.meta}
                      </ThemedText>
                    ) : null}
                  </View>
                  {selected && (
                    <Icon
                      name={{ sf: 'checkmark', md: 'check' }}
                      size={15}
                      color={tokens.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
