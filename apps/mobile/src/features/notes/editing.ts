/**
 * What the note toolbar's buttons do to the text and the selection — pure, so
 * it is tested rather than tapped through. The person sees the dialect's
 * markers; these put them in the right place so nobody has to type `**`.
 */

export interface Selection {
  start: number;
  end: number;
}

export interface Edit {
  text: string;
  selection: Selection;
}

/**
 * Bold, italic, strike: wrap the selection in `marker`, or unwrap it if it is
 * already wrapped. With nothing selected, a pair goes in with the caret
 * between, ready to type into.
 *
 * Whitespace at the selection's edges stays outside the markers — a
 * double-tapped word often drags a space with it, and a marker followed by a
 * space does not open (the dialect's flanking rule).
 */
export function toggleWrap(text: string, selection: Selection, marker: string): Edit {
  const { start, end } = selection;

  if (start === end) {
    // Caret just inside an empty pair: take the pair back out.
    if (text.slice(start - marker.length, start) === marker && text.slice(start, start + marker.length) === marker) {
      return {
        text: text.slice(0, start - marker.length) + text.slice(start + marker.length),
        selection: { start: start - marker.length, end: start - marker.length },
      };
    }
    return {
      text: text.slice(0, start) + marker + marker + text.slice(end),
      selection: { start: start + marker.length, end: start + marker.length },
    };
  }

  const chosen = text.slice(start, end);
  const lead = chosen.length - chosen.trimStart().length;
  const trail = chosen.length - chosen.trimEnd().length;
  const from = start + lead;
  const to = end - trail;
  if (from >= to) return { text, selection };

  const before = text.slice(from - marker.length, from);
  const after = text.slice(to, to + marker.length);
  // `*` must not mistake the inner half of `**bold**` for its own pair.
  const isSingle =
    marker === '*'
      ? text[from - marker.length - 1] !== '*' && text[to + marker.length] !== '*'
      : true;
  if (before === marker && after === marker && isSingle) {
    return {
      text: text.slice(0, from - marker.length) + text.slice(from, to) + text.slice(to + marker.length),
      selection: { start: from - marker.length, end: to - marker.length },
    };
  }

  return {
    text: text.slice(0, from) + marker + text.slice(from, to) + marker + text.slice(to),
    selection: { start: from + marker.length, end: to + marker.length },
  };
}

const PREFIX = /^( *)(- |\d+\. )?/;

/**
 * Bullets or numbers on every line the selection touches. If they all
 * already have that kind, it comes off; otherwise it goes on (replacing the
 * other kind), numbered from 1 for a numbered list. Indentation is kept, so a
 * nested item stays nested.
 */
export function toggleList(text: string, selection: Selection, kind: 'bullet' | 'number'): Edit {
  const lineStart = text.lastIndexOf('\n', selection.start - 1) + 1;
  const nextBreak = text.indexOf('\n', Math.max(selection.end, selection.start));
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;

  const lines = text.slice(lineStart, lineEnd).split('\n');
  const isKind = (line: string) => {
    const marker = PREFIX.exec(line)![2] ?? '';
    return kind === 'bullet' ? marker === '- ' : /^\d+\. $/.test(marker);
  };
  const removing = lines.every(isKind);

  let n = 0;
  const changed = lines.map((line) => {
    const [, indent, marker = ''] = PREFIX.exec(line)!;
    const body = line.slice(indent.length + marker.length);
    if (removing) return indent + body;
    n++;
    return indent + (kind === 'bullet' ? '- ' : `${n}. `) + body;
  });

  const replaced = changed.join('\n');
  const delta = replaced.length - (lineEnd - lineStart);
  const caretOnly = selection.start === selection.end;
  return {
    text: text.slice(0, lineStart) + replaced + text.slice(lineEnd),
    // A caret follows its text; a selection grows to cover the edited lines.
    selection: caretOnly
      ? {
          start: Math.max(lineStart, selection.start + (changed[0].length - lines[0].length)),
          end: Math.max(lineStart, selection.start + (changed[0].length - lines[0].length)),
        }
      : { start: lineStart, end: lineEnd + delta },
  };
}
