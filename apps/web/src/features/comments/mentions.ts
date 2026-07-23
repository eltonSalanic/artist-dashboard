export interface MentionTarget {
  id: string;
  displayName: string;
}

/** A run of a comment body: either plain text or a resolved `@mention`. */
export type CommentSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; id: string };

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
 * Splits a comment body into plain-text runs and mention chips so it can be
 * rendered as plain text — no markdown parsing — with mentions highlighted.
 */
export function splitMentions(
  body: string,
  members: MentionTarget[],
): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let cursor = 0;
  for (const { id, match, index } of eachMention(body, members)) {
    if (index > cursor) {
      segments.push({ type: "text", value: body.slice(cursor, index) });
    }
    segments.push({ type: "mention", value: match, id });
    cursor = index + match.length;
  }
  if (cursor < body.length) {
    segments.push({ type: "text", value: body.slice(cursor) });
  }
  return segments;
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
