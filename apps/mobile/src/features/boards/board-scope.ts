/**
 * What a cross-board tab's band filter *is*, with none of the machinery that
 * stores it.
 *
 * Split from the hook next door so this half can be tested: it imports no
 * native module, which is the same reason `chunked-store.ts` takes its keychain
 * as an argument. The hook adds persistence and React.
 */

/**
 * Which tab's filter. Each gets its own stored value: filtering the Calendar to
 * one band must not silently filter the Inbox — they are separate reading tasks,
 * and a filter you did not set on the tab you are looking at is how a person
 * concludes the app has lost their mentions.
 */
export type BoardScopeTab = 'calendar' | 'inbox';

/**
 * The stored filter, re-derived from live membership.
 *
 * Separate and exported because the case it guards is the one that cannot be
 * reproduced by using the app: the id outlives the membership. Someone removed
 * from a band still has that band selected on their phone, and sending the id
 * anyway asks the server to filter by a board it will intersect down to
 * nothing — an inbox that is silently, permanently empty with no way to tell
 * why. An unknown id reads as "all".
 */
export function scopeFromStored(
  storedId: string | undefined,
  boards: readonly { id: string }[],
): string | undefined {
  if (storedId === undefined) return undefined;
  return boards.some((board) => board.id === storedId) ? storedId : undefined;
}
