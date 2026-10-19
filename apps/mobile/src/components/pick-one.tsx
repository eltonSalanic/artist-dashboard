import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { posterRadius, spacing, useTokens } from '@/theme';
import { FieldLabel } from './field-label';
import { Icon } from './icon';
import { PosterText } from './poster-text';

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
    <View style={{ gap: spacing.xs + 2 }}>
      <FieldLabel>{label}</FieldLabel>
      <View
        style={{
          borderRadius: posterRadius.block,
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
          <PosterText
            variant="field"
            numberOfLines={1}
            color={chosen ? tokens.foreground : tokens.mutedForeground}
            style={{ flex: 1 }}
          >
            {chosen?.label ?? noneLabel}
          </PosterText>
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
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: tokens.border,
                    backgroundColor: pressed ? tokens.accent : undefined,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <PosterText
                      variant="field"
                      numberOfLines={2}
                      color={option.value === null ? tokens.mutedForeground : tokens.foreground}
                    >
                      {option.label}
                    </PosterText>
                    {option.meta ? (
                      <PosterText variant="meta" color={tokens.mutedForeground} numberOfLines={1}>
                        {option.meta}
                      </PosterText>
                    ) : null}
                  </View>
                  {selected && (
                    <Icon
                      name={{ sf: 'checkmark', md: 'check' }}
                      size={15}
                      color={tokens.foreground}
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
