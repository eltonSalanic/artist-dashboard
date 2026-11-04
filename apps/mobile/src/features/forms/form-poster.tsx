import type { ReactNode, Ref } from 'react';
import { View } from 'react-native';
import { TextInput } from '@/components/text-input';
import { PosterText } from '@/components/poster-text';
import { BandTag } from '@/features/board/detail-poster';
import {
  DISPLAY_SCALE,
  poster,
  posterRadius,
  spacing,
  useShadows,
  useTokens,
  type WidgetInk,
} from '@/theme';

/**
 * The top of a create/edit form: the block the item will open as
 * (`DetailPoster`), with its title typed straight onto it. So a new task is
 * written on a To-Do's-coloured block and a show on a Shows-coloured one, and
 * the form already looks like what saving it makes.
 *
 * The title wraps rather than scrolling sideways: a long one is still read
 * whole, as it will be on the detail screen. The band's name tops it as it
 * does the detail block, so nobody adds a show to the wrong band.
 *
 * `required` puts a red asterisk after the title. Once a save finds it empty
 * (`error`), the block takes a red outline and says what's missing in its own
 * ink: red type on a coral or berry block would not read.
 */
export function FormPoster({
  boardId,
  ink,
  label,
  fieldLabel,
  placeholder,
  value,
  onChangeText,
  autoFocus,
  maxLength,
  required,
  error,
  ref,
  children,
}: {
  boardId: string;
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
  required?: boolean;
  error?: string | null;
  ref?: Ref<TextInput>;
  /** A control that belongs on the block, under the title. */
  children?: ReactNode;
}) {
  const shadows = useShadows();
  const tokens = useTokens();
  const failed = error != null && error !== '';
  return (
    <View
      style={{
        backgroundColor: ink.bg,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        padding: spacing.md + 2,
        gap: spacing.sm,
        // Always there, transparent, so an error outline doesn't shift the block.
        borderWidth: 2,
        borderColor: failed ? tokens.destructive : 'transparent',
        boxShadow: ink.plain ? shadows.card : shadows.raised,
      }}
    >
      <BandTag boardId={boardId} ink={ink} />
      <PosterText variant="label" color={ink.ink} accessibilityRole="header">
        {label.toUpperCase()}
      </PosterText>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <TextInput
          ref={ref}
          accessibilityLabel={required ? `${fieldLabel}, required` : fieldLabel}
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
            { flex: 1, color: ink.ink, padding: 0, minHeight: poster.statement.lineHeight },
          ]}
        />
        {required && (
          <PosterText
            variant="statement"
            color={tokens.destructive}
            accessible={false}
            maxFontSizeMultiplier={DISPLAY_SCALE}
          >
            *
          </PosterText>
        )}
      </View>
      {failed && (
        <PosterText variant="meta" color={ink.ink} accessibilityRole="alert">
          {error}
        </PosterText>
      )}
      {children}
    </View>
  );
}
