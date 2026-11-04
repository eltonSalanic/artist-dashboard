import type { Ref } from 'react';
import { Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { posterRadius, spacing, useTokens } from '@/theme';
import { RequiredMark } from './field-label';
import { Icon } from './icon';
import { PosterText } from './poster-text';

/**
 * A labelled date, or date and time, using each platform's own picker.
 *
 * iOS gets the compact picker inline — the system pill that opens the calendar
 * popover. Android has no inline picker and no combined mode, so a tap opens
 * the date dialog and, for a date-time, the time dialog after it.
 *
 * The value is a plain local `Date`. What it *means* is the caller's job: a due
 * date is a calendar day and goes through `dueDateFromLocalDay`; an event's
 * start is an instant and goes through `toISOString()`.
 */
export function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  clearable = true,
  emptyLabel = 'None',
  required,
  error,
  ref,
}: {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  mode?: 'date' | 'datetime';
  /** Offer a way back to no date. Off for a required field. */
  clearable?: boolean;
  emptyLabel?: string;
  /** A red asterisk after the label. */
  required?: boolean;
  /** Shown under the row, which takes a red outline, as a `TextField` does. */
  error?: string | null;
  ref?: Ref<View>;
}) {
  const tokens = useTokens();
  const failed = error != null && error !== '';

  // Where a picker opens when there is no value yet: today, at the next hour
  // for a date-time — a show is never at the current minute.
  const seed = () => {
    const now = new Date();
    if (mode === 'datetime') now.setHours(now.getHours() + 1, 0, 0, 0);
    else now.setHours(0, 0, 0, 0);
    return now;
  };

  const openAndroid = () => {
    const start = value ?? seed();
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      onValueChange: (_event, date) => {
        if (mode === 'date') return onChange(date);
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          onValueChange: (_e, time) => onChange(time),
          // Backing out of the time keeps the day that was just chosen.
          onDismiss: () => onChange(date),
        });
      },
    });
  };

  const formatted = value
    ? mode === 'date'
      ? value.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : value.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
    : emptyLabel;

  return (
    <View style={{ gap: spacing.xs + 2 }}>
      <View
        ref={ref}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: spacing.md,
          borderRadius: posterRadius.block,
          borderCurve: 'continuous',
          backgroundColor: tokens.muted,
          borderWidth: 1.5,
          borderColor: failed ? tokens.destructive : 'transparent',
        }}
      >
        <PosterText variant="rowTitle" color={tokens.foreground} style={{ flex: 1 }}>
          {label}
          {required && <RequiredMark color={tokens.destructive} variant="rowTitle" />}
        </PosterText>

        {process.env.EXPO_OS === 'ios' && value ? (
          <DateTimePicker
            value={value}
            mode={mode}
            display="compact"
            onValueChange={(_event, date) => onChange(date)}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${formatted}`}
            accessibilityHint="Opens a date picker"
            hitSlop={8}
            onPress={() =>
              process.env.EXPO_OS === 'ios' ? onChange(seed()) : openAndroid()
            }
          >
            {/* Empty, the action is set a weight up so it reads as tappable
                without borrowing the app's blue onto the poster screens. */}
            <PosterText variant={value ? 'field' : 'rowTitle'} color={tokens.foreground}>
              {value ? formatted : `Add ${mode === 'date' ? 'date' : 'time'}`}
            </PosterText>
          </Pressable>
        )}

        {clearable && value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            hitSlop={10}
            onPress={() => onChange(null)}
          >
            <Icon
              name={{ sf: 'xmark.circle.fill', md: 'cancel' }}
              size={18}
              color={tokens.mutedForeground}
            />
          </Pressable>
        )}
      </View>
      {failed && (
        <PosterText variant="meta" color={tokens.destructive}>
          {error}
        </PosterText>
      )}
    </View>
  );
}
