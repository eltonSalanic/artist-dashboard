import type { ReactNode } from 'react';
import { TextInput, View } from 'react-native';
import { PosterText } from '@/components/poster-text';
import { DISPLAY_SCALE, poster, posterRadius, shadows, spacing, type WidgetInk } from '@/theme';

/**
 * The top of a create/edit form: the block the item will open as
 * (`DetailPoster`), with its title typed straight onto it. So a new task is
 * written on a To-Do's-coloured block and a show on a Shows-coloured one, and
 * the form already looks like what saving it makes.
 *
 * The title wraps rather than scrolling sideways: a long one is still read
 * whole, as it will be on the detail screen.
 */
export function FormPoster({
  ink,
  label,
  fieldLabel,
  placeholder,
  value,
  onChangeText,
  autoFocus,
  maxLength,
  children,
}: {
  ink: WidgetInk;
  /** The kind across the top: "New task", "Edit show". */
  label: string;
  /** What the field is called to a screen reader: "Title", "Goal". */
  fieldLabel: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
  maxLength?: number;
  /** A control that belongs on the block, under the title. */
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: ink.bg,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        padding: spacing.md + 2,
        gap: spacing.sm,
        boxShadow: ink.plain ? shadows.card : shadows.raised,
      }}
    >
      <PosterText variant="label" color={ink.ink} accessibilityRole="header">
        {label.toUpperCase()}
      </PosterText>
      <TextInput
        accessibilityLabel={fieldLabel}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ink.soft}
        selectionColor={ink.ink}
        cursorColor={ink.ink}
        autoFocus={autoFocus}
        maxLength={maxLength}
        multiline
        // Multiline so it wraps, but Return still means "done": a title has
        // no line breaks.
        submitBehavior="blurAndSubmit"
        returnKeyType="done"
        maxFontSizeMultiplier={DISPLAY_SCALE}
        style={[
          poster.statement,
          { color: ink.ink, padding: 0, minHeight: poster.statement.lineHeight },
        ]}
      />
      {children}
    </View>
  );
}
