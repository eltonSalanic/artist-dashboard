import { useTokens } from '@/theme';
import { PosterText, type PosterVariant } from './poster-text';

/**
 * The name over a form field, in the small caps a block uses for its kind
 * ("TASK", "FOR YOU"), so a form reads as part of the same poster set as the
 * screen it opened from. `required` adds a red asterisk; screen readers get
 * "required" from the field itself.
 */
export function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  const tokens = useTokens();
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
