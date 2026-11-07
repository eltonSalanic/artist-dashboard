import type { Ref } from 'react';
import { Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { posterRadius, spacing, useTokens } from '@/theme';
import { FieldLabel, RequiredMark, useFieldLabelStyle } from './field-label';
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
  hint,
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
  /** One plain line under the field's heading saying what it is for. */
  hint?: string;
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
  // In a form the name is a heading over the row, as every other field's is,
  // and the row holds only the date. Elsewhere it stays a settings-style row
  // with the name on the left.
  const headed = useFieldLabelStyle() === 'heading';

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

  // The row itself opens the picker until iOS has a value to show in its pill.
  const opens = !(process.env.EXPO_OS === 'ios' && value);
  const open = () => (process.env.EXPO_OS === 'ios' ? onChange(seed()) : openAndroid());

  return (
    <View style={{ gap: spacing.xs + 2 }}>
      {headed && (
        <FieldLabel required={required} hint={hint}>
          {label}
        </FieldLabel>
      )}
      {/* Until there is a value (and always on Android, where the dialog is the
          picker) the whole row is the button, not just its words. Once iOS has
          a value, its own pill takes the taps. In a form the value sits in the
          middle of the box, with the clear button pinned to the right. */}
      <Pressable
        ref={ref}
        disabled={!opens}
        accessible={opens}
        accessibilityRole={opens ? 'button' : undefined}
        accessibilityLabel={opens ? `${label}: ${formatted}` : undefined}
        accessibilityHint={opens ? 'Opens a date picker' : undefined}
        onPress={open}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: headed ? 'center' : undefined,
          gap: spacing.sm,
          minHeight: 48,
          paddingHorizontal: headed && clearable && value ? spacing.md + 26 : spacing.md,
          borderRadius: posterRadius.block,
          borderCurve: 'continuous',
          backgroundColor: tokens.muted,
          borderWidth: 1.5,
          borderColor: failed ? tokens.destructive : 'transparent',
          opacity: pressed ? 0.75 : 1,
        })}
      >
        {!headed && (
          <PosterText variant="rowTitle" color={tokens.foreground} style={{ flex: 1 }}>
            {label}
            {required && <RequiredMark color={tokens.destructive} variant="rowTitle" />}
          </PosterText>
        )}

        {process.env.EXPO_OS === 'ios' && value ? (
          <DateTimePicker
            value={value}
            mode={mode}
            display="compact"
            onValueChange={(_event, date) => onChange(date)}
          />
        ) : (
          // Empty, the action is set a weight up so it reads as tappable
          // without borrowing the app's blue onto the poster screens.
          <PosterText variant={value ? 'field' : 'rowTitle'} color={tokens.foreground}>
            {value ? formatted : `Add ${mode === 'date' ? 'date' : 'time'}`}
          </PosterText>
        )}

        {clearable && value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            hitSlop={10}
            onPress={() => onChange(null)}
            style={headed ? { position: 'absolute', right: spacing.md } : undefined}
          >
            <Icon
              name={{ sf: 'xmark.circle.fill', md: 'cancel' }}
              size={18}
              color={tokens.mutedForeground}
            />
          </Pressable>
        )}
      </Pressable>
      {failed && (
        <PosterText variant="meta" color={tokens.destructive}>
          {error}
        </PosterText>
      )}
    </View>
  );
}
