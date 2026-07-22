export interface MentionTarget {
  id: string;
  displayName: string;
}

/** Href prefix the markdown renderer uses to spot a mention link. */
export const MENTION_HREF = "#mention-";

/**
 * The `@…` token being typed at the caret, if there is one.
 *
 * A mention only starts at the beginning of a word, so an email address never
 * turns the rest of the line into an autocomplete.
 */
export function findMentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const char = text[i];
    if (char === "@") {
      const before = i > 0 ? text[i - 1] : "";
      if (before && !/\s/.test(before)) return null;
      return { start: i, query: text.slice(i + 1, caret) };
    }
    // Names can't contain whitespace, so a space ends the search.
    if (/\s/.test(char)) return null;
  }
  return null;
}

/** Replaces the token under the caret with a completed mention. */
export function applyMention(
  text: string,
  start: number,
  caret: number,
  displayName: string,
): { text: string; caret: number } {
  const inserted = `@${displayName} `;
  return {
    text: text.slice(0, start) + inserted + text.slice(caret),
    caret: start + inserted.length,
  };
}

export function matchMembers(
  members: MentionTarget[],
  query: string,
  limit = 5,
): MentionTarget[] {
  const needle = query.toLowerCase();
  return members
    .filter((m) => m.displayName.toLowerCase().startsWith(needle))
    .slice(0, limit);
}

/** Ids of every board member the body actually mentions, de-duplicated. */
export function collectMentionIds(
  body: string,
  members: MentionTarget[],
): string[] {
  const ids = new Set<string>();
  for (const { id } of eachMention(body, members)) ids.add(id);
  return [...ids];
}

/**
 * Rewrites `@name` into a markdown link the renderer styles as a mention chip.
 * Doing it before parsing keeps react-markdown as the only thing that ever
 * touches raw comment text.
 */
export function linkifyMentions(
  body: string,
  members: MentionTarget[],
): string {
  let result = "";
  let cursor = 0;
  for (const { id, match, index } of eachMention(body, members)) {
    const name = match.slice(1); // drop the '@'
    result += body.slice(cursor, index);
    result += `[@${name}](${MENTION_HREF}${id})`;
    cursor = index + match.length;
  }
  return result + body.slice(cursor);
}

/**
 * Walks the `@name` matches in order. Longer names are tried first so
 * "@sam.jones" never matches as "@sam" with a stray suffix.
 */
function* eachMention(
  body: string,
  members: MentionTarget[],
): Generator<{ id: string; match: string; index: number }> {
  const byLength = [...members].sort(
    (a, b) => b.displayName.length - a.displayName.length,
  );
  if (byLength.length === 0) return;

  const names = byLength.map((m) => escapeRegExp(m.displayName)).join("|");
  const idsByName = new Map(
    byLength.map((m) => [m.displayName.toLowerCase(), m.id]),
  );
  const pattern = new RegExp(`(^|\\s)@(${names})(?![\\w.@-])`, "gi");

  for (const match of body.matchAll(pattern)) {
    const id = idsByName.get(match[2].toLowerCase());
    if (!id) continue;
    yield {
      id,
      match: `@${match[2]}`,
      index: match.index + match[1].length,
    };
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
