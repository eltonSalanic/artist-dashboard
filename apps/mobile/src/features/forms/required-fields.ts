import { useState, type RefObject } from 'react';
import type { TextInput } from '@/components/text-input';
import { firstMissing, missingMessage, type Checked } from './missing-fields';

export type RequiredField = Checked<RefObject<TextInput | null>>;

export type RequiredFields = {
  /**
   * The named field's message once a save found it missing, else null. By
   * name, not ref: a ref passed around during render is one the compiler
   * can't trust.
   */
  error: (name: string) => string | null;
  /**
   * The first missing field, in the order the form listed them (top to
   * bottom), and from now on show every missing field's message. Null when
   * nothing is missing.
   */
  check: () => TextInput | null;
};

/**
 * The fields a form cannot save without. Save stays tappable while one is
 * empty: tapping it takes you to the first that is (`FormScreen` scrolls to it
 * and focuses it) rather than leaving a greyed-out button with no reason
 * given. Messages wait for that first tap, so a fresh form isn't covered in red.
 */
export function useRequiredFields(fields: RequiredField[]): RequiredFields {
  const [tried, setTried] = useState(false);

  return {
    error: (name) => missingMessage(fields, name, tried),
    check: () => {
      const first = firstMissing(fields);
      if (!first) return null;
      setTried(true);
      return first.ref.current;
    },
  };
}
