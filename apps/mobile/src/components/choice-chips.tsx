import { Pressable, View } from 'react-native';
import { posterRadius, spacing, useTokens } from '@/theme';
import { FieldLabel } from './field-label';
import { PosterText } from './poster-text';

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
 *
 * Set as the band filter and the widget pills are: Spotify's chips, grey until
 * chosen, then filled with the page's ink.
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
    <View style={{ gap: spacing.xs + 2 }}>
      <FieldLabel>{label}</FieldLabel>
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
              hitSlop={4}
              style={({ pressed }) => ({
                minHeight: 36,
                justifyContent: 'center',
                paddingHorizontal: spacing.md - 2,
                borderRadius: posterRadius.chip,
                borderCurve: 'continuous',
                // Filled, not just tinted, when chosen — the same rule as the
                // band filter, so selection never rests on a hue difference.
                backgroundColor: selected ? tokens.foreground : tokens.muted,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {/* One line at the chip style's fixed line height, or iOS sizes
                  the box shorter than the letters and clips them. */}
              <PosterText
                variant="chip"
                numberOfLines={1}
                color={selected ? tokens.background : tokens.foreground}
              >
                {choice.label}
              </PosterText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
