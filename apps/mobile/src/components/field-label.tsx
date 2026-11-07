import { createContext, use, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { BODY_SCALE, spacing, uiText, useTokens } from '@/theme';
import { PosterText, type PosterVariant } from './poster-text';

/**
 * How field names are set. A create/edit form (`FormScreen`, Create a band)
 * gives each field a real heading, as the Finances screen heads its sections:
 * the field is the thing being decided, and a big sentence-case name reads as
 * a question to answer. Everywhere else (filter sheets, settings, sign-in) a
 * field is a small control among others, and keeps the small caps a block
 * uses for its kind ("TASK", "FOR YOU").
 */
export type FieldLabelStyle = 'caps' | 'heading';

const FieldLabelStyleContext = createContext<FieldLabelStyle>('caps');

/** Sets every field under it to big headings. */
export function FieldHeadings({ children }: { children: ReactNode }) {
  return <FieldLabelStyleContext value="heading">{children}</FieldLabelStyleContext>;
}

/**
 * Sets every field under it back to small caps, for a form that groups its
 * fields into cards (the finance form): there each card is the heading, and a
 * big heading per field would shout over it.
 */
export function FieldCaps({ children }: { children: ReactNode }) {
  return <FieldLabelStyleContext value="caps">{children}</FieldLabelStyleContext>;
}

export const useFieldLabelStyle = () => use(FieldLabelStyleContext);

/**
 * The name over a form field. `required` adds a red asterisk; screen readers
 * get "required" from the field itself.
 *
 * `hint` is one plain line under a heading for a field whose name doesn't say
 * what it does ("Show": filing money against a show). Most fields need none.
 * Only drawn as a heading: a small caps label has no room for a second line.
 */
export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: string;
  required?: boolean;
  hint?: string;
}) {
  const tokens = useTokens();
  const style = useFieldLabelStyle();

  if (style === 'heading') {
    return (
      <View style={{ gap: 2, marginBottom: spacing.xs }}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={BODY_SCALE}
          style={[uiText.title, { color: tokens.foreground }]}
        >
          {children}
          {required && (
            <Text accessible={false} style={{ color: tokens.destructive }}>
              {' *'}
            </Text>
          )}
        </Text>
        {hint ? (
          <PosterText variant="cardMeta" color={tokens.mutedForeground}>
            {hint}
          </PosterText>
        ) : null}
      </View>
    );
  }

  return (
    <PosterText variant="label" color={tokens.mutedForeground}>
      {children.toUpperCase()}
      {required && <RequiredMark color={tokens.destructive} />}
    </PosterText>
  );
}

/** The red asterisk after a required field's name. Nest it in the name's text. */
export function RequiredMark({
  color,
  variant = 'label',
}: {
  color: string;
  variant?: PosterVariant;
}) {
  return (
    <PosterText variant={variant} color={color} accessible={false}>
      {' *'}
    </PosterText>
  );
}
