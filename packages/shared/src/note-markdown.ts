/**
 * The Notes widget as text a phone can edit, and back.
 *
 * The note is stored as a TipTap (ProseMirror) document — web edits it with
 * TipTap's StarterKit. React Native has no rich-text input, and the one RN
 * port of TipTap runs inside a WebView, which this app does not ship. So the
 * phone edits a small markdown dialect in a native text field and converts on
 * save; it renders the document natively when reading.
 *
 * The dialect is this module's own, not CommonMark — both directions live
 * here, so they only have to agree with each other:
 *
 *   paragraphs      separated by a blank line; a single newline is a line break
 *   empty paragraph each extra pair of blank lines
 *   # … ######      headings
 *   - item / 1. item  lists, nested by indenting
 *   > quote         blockquote (paragraphs only)
 *   ```lang         code block, closed by ```
 *   ---             horizontal rule
 *   **bold** *italic* ~~strike~~ `code` [text](url), and bare URLs as links
 *   \x              x, literally
 *
 * **The safety rule.** The phone may only edit a note this module can carry
 * both ways without loss — `isMarkdownEditable`. Anything else (underline,
 * which markdown has no syntax for; a quote holding a list; a node type from
 * an extension web adds later) leaves the note read-only on the phone rather
 * than flattening what web wrote.
 */

// Type aliases, not interfaces: an alias is assignable to the
// `Record<string, unknown>` the API's DTO uses for the note, an interface is not.
export type NoteMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type NoteNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoteNode[];
  text?: string;
  marks?: NoteMark[];
};

// ─── What the dialect can carry ─────────────────────────────────────────────

const MARK_RANK: Record<string, number> = {
  link: 0,
  bold: 1,
  italic: 2,
  strike: 3,
  code: 4,
};

const LIST_TYPES = new Set(['bulletList', 'orderedList']);

function isNode(value: unknown): value is NoteNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as NoteNode).type === 'string'
  );
}

function inlineEditable(nodes: unknown, allowBreaks: boolean): boolean {
  if (nodes === undefined) return true;
  if (!Array.isArray(nodes)) return false;
  return nodes.every((node) => {
    if (!isNode(node)) return false;
    if (node.type === 'hardBreak') return allowBreaks;
    if (node.type !== 'text' || typeof node.text !== 'string') return false;
    const marks = node.marks ?? [];
    if (!marks.every((m) => isNode(m) && m.type in MARK_RANK)) return false;
    // A newline inside a run has no spelling: in this dialect it is a break.
    if (node.text.includes('\n')) return false;
    const code = marks.some((m) => m.type === 'code');
    // Code excludes every other mark in ProseMirror, and a backtick inside it
    // has no spelling in this dialect.
    if (code && (marks.length > 1 || node.text.includes('`'))) return false;
    const link = marks.find((m) => m.type === 'link');
    if (link && typeof link.attrs?.href !== 'string') return false;
    return true;
  });
}

function blockEditable(node: unknown): boolean {
  if (!isNode(node)) return false;
  switch (node.type) {
    case 'paragraph':
      return inlineEditable(node.content, true);
    case 'heading': {
      const level = node.attrs?.level;
      return (
        typeof level === 'number' &&
        level >= 1 &&
        level <= 6 &&
        inlineEditable(node.content, false)
      );
    }
    case 'horizontalRule':
      return true;
    case 'codeBlock': {
      const content = node.content ?? [];
      if (!Array.isArray(content)) return false;
      return content.every(
        (child) =>
          isNode(child) &&
          child.type === 'text' &&
          !child.marks?.length &&
          // A fence line inside would end the block early.
          !/^```/m.test(child.text ?? ''),
      );
    }
    case 'blockquote':
      return (
        Array.isArray(node.content) &&
        node.content.length > 0 &&
        node.content.every(
          (child) =>
            isNode(child) &&
            child.type === 'paragraph' &&
            // An empty paragraph inside a quote has no spelling.
            Array.isArray(child.content) &&
            child.content.length > 0 &&
            inlineEditable(child.content, true),
        )
      );
    case 'bulletList':
    case 'orderedList':
      return listEditable(node);
    default:
      return false;
  }
}

function listEditable(node: NoteNode): boolean {
  if (node.type === 'orderedList') {
    const start = node.attrs?.start ?? 1;
    // `type` is TipTap's a/i/A/I numbering, which the dialect cannot say.
    if (typeof start !== 'number' || start < 0) return false;
    if (node.attrs?.type != null) return false;
  }
  if (!Array.isArray(node.content) || node.content.length === 0) return false;
  return node.content.every((item) => {
    if (!isNode(item) || item.type !== 'listItem') return false;
    const [first, ...rest] = item.content ?? [];
    return (
      isNode(first) &&
      first.type === 'paragraph' &&
      inlineEditable(first.content, true) &&
      rest.every((child) => isNode(child) && LIST_TYPES.has(child.type) && listEditable(child))
    );
  });
}

/**
 * Whether the phone may edit this note. False means it renders read-only with
 * a pointer to web — never that it gets edited lossily.
 */
export function isMarkdownEditable(doc: unknown): boolean {
  if (!isNode(doc) || doc.type !== 'doc') return false;
  if (doc.content === undefined) return true;
  return Array.isArray(doc.content) && doc.content.every(blockEditable);
}

// ─── Document → text ────────────────────────────────────────────────────────

const sortMarks = (marks: NoteMark[] = []) =>
  [...marks].sort((a, b) => MARK_RANK[a.type] - MARK_RANK[b.type]);

const sameMark = (a: NoteMark, b: NoteMark) =>
  a.type === b.type && (a.type !== 'link' || a.attrs?.href === b.attrs?.href);

function escapeText(text: string): string {
  return (
    text
      // Every tilde, not just pairs: a lone one beside a `~~` marker would
      // otherwise read as part of it.
      .replace(/[\\*`[\]~]/g, (c) => `\\${c}`)
      // An address that is *not* a link on web must not become one: a bare
      // URL reads back as a link. Escaping its colon keeps it text.
      .replace(/(https?):\/\//g, '$1\\://')
  );
}

/**
 * Line starts that would otherwise read as a block — and leading whitespace,
 * which would otherwise read as indentation (or vanish, on a blank line).
 */
const BLOCK_START = /^(#{1,6} |>|- |\d+\. |```|---$|\s)/;

const escapeLineStart = (line: string) => (BLOCK_START.test(line) ? `\\${line}` : line);

const PUNCT_TAIL = /[.,;:!?)\]"']$/;

function openMark(mark: NoteMark): string {
  return mark.type === 'link' ? '[' : MARKERS[mark.type];
}

function closeMark(mark: NoteMark): string {
  if (mark.type !== 'link') return MARKERS[mark.type];
  const href = String(mark.attrs?.href ?? '')
    .replace(/ /g, '%20')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return `](${href})`;
}

const MARKERS: Record<string, string> = {
  bold: '**',
  italic: '*',
  strike: '~~',
  code: '`',
};

/**
 * Inline content as text. Markers are switches, not brackets — the parser
 * reads them as toggles — so between runs only the marks that change are
 * written: closing italic while bold carries on writes `*`, not `***` and a
 * fresh `**`. (Bracket-style nesting writes `****` there, which reads back
 * wrong.) `indent` follows each line break, which keeps a broken line inside
 * its list item.
 */
function serializeInline(nodes: NoteNode[] = [], indent = ''): string {
  let out = '';
  let open: NoteMark[] = [];
  let lineStart = true;

  // Closed innermost-first and opened outermost-first, so a link's `](url)`
  // lands after anything that ends inside it.
  const close = (marks: NoteMark[]) => {
    for (const mark of [...marks].sort((a, b) => MARK_RANK[b.type] - MARK_RANK[a.type])) {
      out += closeMark(mark);
    }
    open = open.filter((m) => !marks.includes(m));
  };

  nodes.forEach((node, index) => {
    if (node.type === 'hardBreak') {
      // Code and links cannot span a line: inside code nothing is escaped, so
      // the next line's start could not be guarded, and a link's text must
      // reach its `](url)` on the same line. Both reopen on the next run.
      close(open.filter((m) => m.type === 'code' || m.type === 'link'));
      out += `\n${indent}`;
      lineStart = true;
      return;
    }
    const text = node.text ?? '';
    const marks = sortMarks(node.marks);

    // A link whose text is its own address, alone on its run, is written bare
    // — the way it was typed, and the way web's autolink would read it back.
    const link = marks[0]?.type === 'link' ? marks[0] : null;
    const prev = nodes[index - 1];
    const next = nodes[index + 1];
    const sharesLink = (other?: NoteNode) =>
      !!link && !!other?.marks?.some((m) => sameMark(m, link));
    if (
      link &&
      marks.length === 1 &&
      text === link.attrs?.href &&
      !/\s/.test(text) &&
      !PUNCT_TAIL.test(text) &&
      !sharesLink(prev) &&
      !sharesLink(next)
    ) {
      close(open);
      out += text;
      lineStart = false;
      return;
    }

    close(open.filter((m) => !marks.some((n) => sameMark(m, n))));
    const opening = marks.filter((m) => !open.some((o) => sameMark(o, m)));
    for (const mark of opening) {
      out += openMark(mark);
      open.push(mark);
    }

    const isCode = marks.some((m) => m.type === 'code');
    let body = isCode ? text : escapeText(text);
    // Text that starts a line needs guarding even inside a mark carried over
    // a line break — "**a⏎- b**" must not turn its second line into a list.
    // A line that starts with a marker this run opened is already safe.
    if (lineStart && opening.length === 0) body = escapeLineStart(body);
    // A marker only opens before non-space (the parser's flanking rule), so
    // a run that really does begin with a space escapes it.
    else if (opening.some((m) => m.type !== 'link' && m.type !== 'code') && /^\s/.test(body)) {
      body = `\\${body}`;
    }
    out += body;
    lineStart = false;
  });

  close(open);
  return out;
}

function serializeList(node: NoteNode, indent: string): string {
  const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1;
  return (node.content ?? [])
    .map((item, index) => {
      const marker = node.type === 'orderedList' ? `${start + index}.` : '-';
      const inner = indent + ' '.repeat(marker.length + 1);
      const [first, ...rest] = item.content ?? [];
      const head = `${indent}${marker} ${serializeInline(first?.content, inner)}`;
      const nested = rest.map((list) => serializeList(list, inner));
      return [head, ...nested].join('\n');
    })
    .join('\n');
}

function serializeBlock(node: NoteNode): string {
  switch (node.type) {
    case 'paragraph':
      return serializeInline(node.content);
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level))} ${serializeInline(node.content)}`;
    case 'horizontalRule':
      return '---';
    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      const text = (node.content ?? []).map((t) => t.text ?? '').join('');
      return `\`\`\`${language}\n${text}\n\`\`\``;
    }
    case 'blockquote':
      return (node.content ?? [])
        .map((p) =>
          serializeInline(p.content)
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n'),
        )
        .join('\n>\n');
    case 'bulletList':
    case 'orderedList':
      return serializeList(node, '');
    default:
      return '';
  }
}

/**
 * A note as editable text. Only call this on a document that passed
 * `isMarkdownEditable`; anything else would come back changed.
 */
export function noteToMarkdown(doc: NoteNode): string {
  const blocks = doc.content ?? [];
  // TipTap keeps a trailing empty paragraph (its TrailingNode extension) and
  // puts it back on load, so it is not text the person wrote.
  let end = blocks.length;
  while (end > 0 && isEmptyParagraph(blocks[end - 1])) end--;
  return blocks.slice(0, end).map(serializeBlock).join('\n\n');
}

const isEmptyParagraph = (node: NoteNode) =>
  node.type === 'paragraph' && (!node.content || node.content.length === 0);

// ─── Text → document ────────────────────────────────────────────────────────

/** A list item: `- ` or `1. `. Not `* `, which would collide with italics. */
const ITEM = /^( *)(-|(\d+)\.)(?: (.*)|$)/;

const indentOf = (line: string) => line.length - line.trimStart().length;

/** Whether an unescaped `marker` occurs in `text` at or after `from`. */
function hasLater(text: string, marker: string, from: number): boolean {
  let at = text.indexOf(marker, from);
  while (at !== -1) {
    let slashes = 0;
    for (let j = at - 1; j >= 0 && text[j] === '\\'; j--) slashes++;
    if (slashes % 2 === 0) return true;
    at = text.indexOf(marker, at + 1);
  }
  return false;
}

const URL_START = /^https?:\/\/\S/;

/**
 * Inline text to ProseMirror nodes. Markers toggle a mark — and only open one
 * when a closing marker follows, so "5 * 3" typed on a phone stays literal
 * instead of italicising the rest of the line.
 */
function parseInline(text: string): NoteNode[] {
  const nodes: NoteNode[] = [];
  let buffer = '';
  const active: NoteMark[] = [];
  let linkEnd = -1;

  const flush = () => {
    if (!buffer) return;
    const marks = sortMarks(active);
    const last = nodes[nodes.length - 1];
    // Same marks as the run before: one run, as ProseMirror would store it.
    if (last?.type === 'text' && marksEqual(last.marks ?? [], marks)) {
      last.text += buffer;
    } else {
      nodes.push(marks.length ? { type: 'text', text: buffer, marks } : { type: 'text', text: buffer });
    }
    buffer = '';
  };

  const toggle = (type: string) => {
    flush();
    const at = active.findIndex((m) => m.type === type);
    if (at === -1) active.push({ type });
    else active.splice(at, 1);
  };

  const inCode = () => active.some((m) => m.type === 'code');
  // Markdown's flanking rule: a marker opens only before non-space. That is
  // what keeps "5 * 3" literal.
  const opensAt = (at: number) => at < text.length && !/\s/.test(text[at]);
  const has = (type: string) => active.some((m) => m.type === type);

  let i = 0;
  while (i < text.length) {
    if (i === linkEnd) {
      // `](url)` — close the link and skip the address.
      flush();
      const close = text.indexOf(')', i);
      active.splice(
        active.findIndex((m) => m.type === 'link'),
        1,
      );
      linkEnd = -1;
      i = close + 1;
      continue;
    }

    const c = text[i];

    if (inCode()) {
      if (c === '`') toggle('code');
      else if (c === '\n') {
        flush();
        nodes.push({ type: 'hardBreak' });
      } else buffer += c;
      i++;
      continue;
    }

    if (c === '\\' && i + 1 < text.length) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (c === '\n') {
      flush();
      nodes.push({ type: 'hardBreak' });
      i++;
      continue;
    }

    // A bare address at a word boundary, as web's autolink would make it —
    // read before any marker, so a `*` or `~~` inside a URL stays put.
    if (!has('link') && (i === 0 || /[\s(]/.test(text[i - 1])) && URL_START.test(text.slice(i))) {
      let end = i;
      while (end < text.length && !/\s/.test(text[end])) end++;
      while (end > i && PUNCT_TAIL.test(text.slice(i, end))) end--;
      flush();
      const href = text.slice(i, end);
      active.push({ type: 'link', attrs: { href } });
      buffer = href;
      flush();
      active.pop();
      i = end;
      continue;
    }

    // Raw search, not escape-aware: inside code nothing is escaped, so the
    // first backtick closes it even after a backslash ("`C:\`").
    if (c === '`' && text.indexOf('`', i + 1) !== -1) {
      toggle('code');
      i++;
      continue;
    }

    if (text.startsWith('**', i) && (has('bold') || (opensAt(i + 2) && hasLater(text, '**', i + 2)))) {
      toggle('bold');
      i += 2;
      continue;
    }

    // A pair that opened no bold is two literal asterisks, not an empty
    // italic span.
    if (text.startsWith('**', i)) {
      buffer += '**';
      i += 2;
      continue;
    }

    if (c === '*' && (has('italic') || (opensAt(i + 1) && hasLater(text, '*', i + 1)))) {
      toggle('italic');
      i++;
      continue;
    }

    if (text.startsWith('~~', i) && (has('strike') || (opensAt(i + 2) && hasLater(text, '~~', i + 2)))) {
      toggle('strike');
      i += 2;
      continue;
    }

    if (c === '[' && !has('link')) {
      const target = findLinkTarget(text, i);
      if (target) {
        flush();
        active.push({ type: 'link', attrs: { href: target.href } });
        linkEnd = target.closeAt;
        i++;
        continue;
      }
    }

    buffer += c;
    i++;
  }

  flush();
  return nodes;
}

/** For `[` at `start`: where its `](url)` begins, and the url — or null. */
function findLinkTarget(text: string, start: number): { closeAt: number; href: string } | null {
  let depth = 0;
  for (let j = start + 1; j < text.length; j++) {
    const c = text[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === '\n') return null;
    if (c === '[') depth++;
    if (c === ']') {
      if (depth > 0) {
        depth--;
        continue;
      }
      if (text[j + 1] !== '(') return null;
      const close = text.indexOf(')', j + 2);
      if (close === -1) return null;
      const href = text.slice(j + 2, close);
      if (!href || /\s/.test(href)) return null;
      return { closeAt: j, href };
    }
  }
  return null;
}

function marksEqual(a: NoteMark[], b: NoteMark[]): boolean {
  return a.length === b.length && a.every((m, i) => sameMark(m, b[i]));
}

const paragraph = (text: string): NoteNode => {
  const content = parseInline(text);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

function parseList(lines: string[], start: number): [NoteNode, number] {
  const first = ITEM.exec(lines[start])!;
  const base = first[1].length;
  const ordered = first[3] !== undefined;
  const items: NoteNode[] = [];
  let i = start;

  while (i < lines.length) {
    const m = ITEM.exec(lines[i]);
    if (!m || m[1].length !== base || (m[3] !== undefined) !== ordered) break;
    const text = [m[4] ?? ''];
    const nested: NoteNode[] = [];
    i++;
    // Everything indented past this item's marker belongs to it: a deeper
    // marker starts a nested list, anything else continues the line.
    while (i < lines.length && lines[i].trim() !== '' && indentOf(lines[i]) > base) {
      const sub = ITEM.exec(lines[i]);
      if (sub) {
        const [list, next] = parseList(lines, i);
        nested.push(list);
        i = next;
      } else {
        text.push(lines[i].trimStart());
        i++;
      }
    }
    items.push({ type: 'listItem', content: [paragraph(text.join('\n')), ...nested] });
  }

  const list: NoteNode = ordered
    ? { type: 'orderedList', attrs: { start: Number(first[3]) }, content: items }
    : { type: 'bulletList', content: items };
  return [list, i];
}

const startsBlock = (line: string) =>
  /^#{1,6} /.test(line) ||
  line.startsWith('>') ||
  ITEM.test(line) ||
  line.startsWith('```') ||
  line === '---';

function parseBlocks(lines: string[]): NoteNode[] {
  const blocks: NoteNode[] = [];
  let i = 0;
  let blank = 0;

  const pushEmpties = (leading: boolean) => {
    // Between blocks, one blank line is the separator and each further pair
    // is an empty paragraph; before the first block there is no separator.
    const count = leading ? Math.floor(blank / 2) : Math.floor((blank - 1) / 2);
    for (let k = 0; k < count; k++) blocks.push({ type: 'paragraph' });
    blank = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      blank++;
      i++;
      continue;
    }
    pushEmpties(blocks.length === 0);

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++; // the closing fence, if there was one
      const text = body.join('\n');
      blocks.push({
        type: 'codeBlock',
        attrs: { language: language || null },
        ...(text ? { content: [{ type: 'text', text }] } : {}),
      });
      continue;
    }

    const heading = /^(#{1,6}) (.*)$/.exec(line);
    if (heading) {
      const content = parseInline(heading[2]);
      blocks.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        ...(content.length ? { content } : {}),
      });
      i++;
      continue;
    }

    if (line === '---') {
      blocks.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    if (line.startsWith('>')) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoted.push(lines[i].replace(/^> ?/, ''));
        i++;
      }
      const content = parseBlocks(quoted).filter((b) => !isEmptyParagraph(b));
      blocks.push({ type: 'blockquote', content: content.length ? content : [{ type: 'paragraph' }] });
      continue;
    }

    if (ITEM.test(line)) {
      const [list, next] = parseList(lines, i);
      blocks.push(list);
      i = next;
      continue;
    }

    const text: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i])) {
      text.push(lines[i]);
      i++;
    }
    blocks.push(paragraph(text.join('\n')));
  }
  return blocks;
}

/** Edited text back to a TipTap document, ready to save. */
export function markdownToNote(text: string): NoteNode {
  // Tabs only in indentation become spaces; a tab inside a sentence is text.
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^[\t ]+/, (lead) => lead.replace(/\t/g, '  ')));
  const content = parseBlocks(lines);
  // ProseMirror's doc needs at least one block.
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/**
 * The form two documents are compared in: what this module models and nothing
 * else — trailing empty paragraphs dropped (TipTap re-adds them), marks in a
 * fixed order, adjacent runs with the same marks merged, links reduced to
 * their address. Exported for tests and for callers asking "did that change?".
 */
export function normalizeNote(doc: NoteNode): NoteNode {
  const blocks = [...(doc.content ?? [])].map(normalizeNode);
  while (blocks.length && isEmptyParagraph(blocks[blocks.length - 1])) blocks.pop();
  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] };
}

function normalizeNode(node: NoteNode): NoteNode {
  if (node.type === 'text') {
    const marks = sortMarks(node.marks).map((m) =>
      m.type === 'link' ? { type: 'link', attrs: { href: m.attrs?.href } } : { type: m.type },
    );
    return marks.length ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text };
  }
  const out: NoteNode = { type: node.type };
  if (node.type === 'heading') out.attrs = { level: node.attrs?.level };
  if (node.type === 'orderedList') out.attrs = { start: node.attrs?.start ?? 1 };
  if (node.type === 'codeBlock') out.attrs = { language: node.attrs?.language ?? null };
  if (node.content?.length) {
    const merged: NoteNode[] = [];
    for (const child of node.content.map(normalizeNode)) {
      const last = merged[merged.length - 1];
      if (
        child.type === 'text' &&
        last?.type === 'text' &&
        marksEqual(last.marks ?? [], child.marks ?? [])
      ) {
        last.text = (last.text ?? '') + (child.text ?? '');
      } else {
        merged.push(child);
      }
    }
    out.content = merged;
  }
  return out;
}
