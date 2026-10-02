/**
 * The first line of the Notes widget, pulled out of a TipTap document.
 *
 * The note is stored as ProseMirror JSON — the editor's own shape, which the
 * API deliberately validates only as "a JSON object". Web renders it with
 * TipTap; the hub needs one line of plain text for a card, and shipping an
 * editor to produce it would be absurd.
 *
 * Unknown node types are walked rather than rejected: the document comes from
 * whatever extensions the web editor had enabled when it was saved, which this
 * file has no way to know and no business tracking.
 */

interface ProseMirrorNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
}

function isNode(value: unknown): value is ProseMirrorNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Depth-first text of one node, with hard breaks treated as spaces.
 *
 * Inline children are concatenated — TipTap splits a line at every mark
 * boundary, so "Bring **two** DI boxes" is three runs of one sentence. Block
 * children get a space between them, because a bullet list is one node holding
 * several paragraphs and gluing those together produces "First itemSecond
 * item". The collapse in `notePreview` tidies up any doubles.
 */
function textOf(node: unknown): string {
  if (!isNode(node)) return '';
  if (typeof node.text === 'string') return node.text;
  if (node.type === 'hardBreak') return ' ';
  if (!Array.isArray(node.content)) return '';

  return node.content.reduce<string>((text, child) => {
    const isBlock = isNode(child) && Array.isArray(child.content);
    return text === '' ? textOf(child) : text + (isBlock ? ' ' : '') + textOf(child);
  }, '');
}

/**
 * Every block of the note as a line of plain text, empties dropped. This is
 * what the read-only spoke renders — one paragraph per `<Text>`, which is a
 * faithful enough rendering of a shared note without bringing an editor along.
 */
export function noteBlocks(
  content: Record<string, unknown> | undefined | null,
): string[] {
  if (!content) return [];
  const blocks = Array.isArray(content.content) ? content.content : [content];
  return blocks
    .map((block) => textOf(block).replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '');
}

/**
 * The first block that has any text in it, for a hub card. Leading empty
 * paragraphs are skipped — a note that opens with a blank line would otherwise
 * preview as nothing.
 */
export function notePreview(
  content: Record<string, unknown> | undefined | null,
  maxLength = 140,
): string | null {
  const first = noteBlocks(content)[0];
  if (first === undefined) return null;
  return first.length > maxLength
    ? `${first.slice(0, maxLength - 1).trimEnd()}…`
    : first;
}
