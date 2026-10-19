import { useTokens } from '@/theme';
import { PosterText } from './poster-text';

/**
 * The name over a form field, in the small caps a block uses for its kind
 * ("TASK", "FOR YOU"), so a form reads as part of the same poster set as the
 * screen it opened from.
 */
export function FieldLabel({ children }: { children: string }) {
  const tokens = useTokens();
  return (
    <PosterText variant="label" color={tokens.mutedForeground}>
      {children.toUpperCase()}
    </PosterText>
  );
}
