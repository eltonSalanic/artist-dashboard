/** The account keeps one name, so the form's two fields are joined for it. */
export const NAME_MAX = 60;

/**
 * First and last name as the one display name the account stores: trimmed, one
 * space between, and just the first name when there is no last name (a band
 * member who goes by one name).
 */
export function joinName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter((part) => part !== '').join(' ');
}
