import { Pressable, View } from 'react-native';
import { radius, spacing, useTokens } from '@/theme';
import { ThemedText } from './themed-text';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/**
 * A short set of options, all visible at once. For a handful of fixed choices
 * (priority, event type, a few bandmates) a row of chips is one tap where a
 * picker is two, and it shows the current choice without opening anything.
 *
 * Single choice by default; `multiple` turns it into a set (assignees).
 */
export function ChoiceChips<T extends string>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice<T>[];
} & (
  | { value: T; onChange: (value: T) => void; multiple?: false }
  | { value: T[]; onChange: (value: T[]) => void; multiple: true }
)) {
  const tokens = useTokens();
  const multiple = Array.isArray(value);
  const isSelected = (choice: T) =>
    multiple ? value.includes(choice) : value === choice;

  const toggle = (choice: T) => {
    if (Array.isArray(value)) {
      const next = value.includes(choice)
        ? value.filter((v) => v !== choice)
        : [...value, choice];
      (onChange as (value: T[]) => void)(next);
    } else {
      (onChange as (value: T) => void)(choice);
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <ThemedText variant="footnote" tone="muted" style={{ fontWeight: '600' }}>
        {label}
      </ThemedText>
      <View
        accessibilityRole={multiple ? undefined : 'radiogroup'}
        accessibilityLabel={label}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}
      >
        {choices.map((choice) => {
          const selected = isSelected(choice.value);
          return (
            <Pressable
              key={choice.value}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={multiple ? { checked: selected } : { selected }}
              onPress={() => toggle(choice.value)}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                // Filled, not just tinted, when chosen — the same rule as the
                // band filter, so selection never rests on a hue difference.
                backgroundColor: selected ? tokens.primary : tokens.muted,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <ThemedText
                variant="subhead"
                style={{
                  fontWeight: '600',
                  color: selected ? tokens.primaryForeground : tokens.foreground,
                }}
              >
                {choice.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
