import {
  isMarkdownEditable,
  markdownToNote,
  normalizeNote,
  noteToMarkdown,
  type NoteMark,
  type NoteNode,
} from './note-markdown';

const doc = (...content: NoteNode[]): NoteNode => ({ type: 'doc', content });
const p = (...content: NoteNode[]): NoteNode =>
  content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
const t = (text: string, ...marks: (string | NoteMark)[]): NoteNode => {
  const m = marks.map((mark) => (typeof mark === 'string' ? { type: mark } : mark));
  return m.length ? { type: 'text', text, marks: m } : { type: 'text', text };
};
const link = (href: string): NoteMark => ({
  type: 'link',
  // What TipTap actually stores; only href survives, and TipTap restores the rest.
  attrs: { href, target: '_blank', rel: 'noopener noreferrer nofollow', class: null },
});
const br: NoteNode = { type: 'hardBreak' };
const bullets = (...items: NoteNode[][]): NoteNode => ({
  type: 'bulletList',
  content: items.map((content) => ({ type: 'listItem', content })),
});
const numbers = (start: number, ...items: NoteNode[][]): NoteNode => ({
  type: 'orderedList',
  attrs: { start, type: null },
  content: items.map((content) => ({ type: 'listItem', content })),
});

/** The property that matters: what the phone saves is what it opened. */
function roundTrips(input: NoteNode) {
  expect(isMarkdownEditable(input)).toBe(true);
  expect(normalizeNote(markdownToNote(noteToMarkdown(input)))).toEqual(normalizeNote(input));
}

describe('noteToMarkdown', () => {
  it('writes the dialect a person would type', () => {
    const note = doc(
      { type: 'heading', attrs: { level: 2 }, content: [t('Setlist notes')] },
      p(t('Bring '), t('two', 'bold'), t(' DI boxes')),
      bullets([p(t('Tune down a half step'))], [p(t('Encore is '), t('Mirrors', 'italic'))]),
      { type: 'paragraph' },
    );
    expect(noteToMarkdown(note)).toBe(
      '## Setlist notes\n\nBring **two** DI boxes\n\n- Tune down a half step\n- Encore is *Mirrors*',
    );
  });

  it('writes a link whose text is its address bare, and any other as [text](url)', () => {
    expect(noteToMarkdown(doc(p(t('https://band.example', link('https://band.example')))))).toBe(
      'https://band.example',
    );
    expect(noteToMarkdown(doc(p(t('the rider', link('https://band.example/rider')))))).toBe(
      '[the rider](https://band.example/rider)',
    );
  });

  it('escapes what would otherwise be markup', () => {
    expect(noteToMarkdown(doc(p(t('5 * 3 = 15, [maybe] `x` ~~no~~ ~ish'))))).toBe(
      '5 \\* 3 = 15, \\[maybe\\] \\`x\\` \\~\\~no\\~\\~ \\~ish',
    );
    expect(noteToMarkdown(doc(p(t('- not a list'))))).toBe('\\- not a list');
    expect(noteToMarkdown(doc(p(t('2. not a list either'))))).toBe('\\2. not a list either');
  });
});

describe('markdownToNote', () => {
  it('reads what a person types on a phone', () => {
    expect(normalizeNote(markdownToNote('Shopping:\n- milk\n- *oat* milk'))).toEqual(
      normalizeNote(doc(p(t('Shopping:')), bullets([p(t('milk'))], [p(t('oat', 'italic'), t(' milk'))]))),
    );
  });

  // A stray asterisk is far more often maths or a footnote than markup.
  it('leaves an unclosed marker literal', () => {
    expect(normalizeNote(markdownToNote('5 * 3 and ** nothing'))).toEqual(
      normalizeNote(doc(p(t('5 * 3 and ** nothing')))),
    );
  });

  it('treats a single newline as a line break and a blank line as a new paragraph', () => {
    expect(normalizeNote(markdownToNote('one\ntwo\n\nthree'))).toEqual(
      normalizeNote(doc(p(t('one'), br, t('two')), p(t('three')))),
    );
  });

  it('turns a bare address into a link, as web autolinks it', () => {
    expect(normalizeNote(markdownToNote('rider at https://band.example/rider.'))).toEqual(
      normalizeNote(
        doc(p(t('rider at '), t('https://band.example/rider', link('https://band.example/rider')), t('.'))),
      ),
    );
  });

  it('gives an empty text an empty — but valid — document', () => {
    expect(markdownToNote('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('reads "* " as text, not a bullet, so it never fights italics', () => {
    expect(markdownToNote('* not a bullet').content?.[0].type).toBe('paragraph');
  });
});

describe('round trip', () => {
  it.each<[string, NoteNode]>([
    ['plain paragraphs', doc(p(t('One')), p(t('Two')))],
    ['empty paragraphs kept between blocks', doc(p(t('A')), p(), p(), p(t('B')))],
    ['a leading empty paragraph', doc(p(), p(t('A')))],
    ['every mark, overlapping', doc(p(t('a'), t('b', 'bold'), t('c', 'bold', 'italic'), t('d', 'italic'), t('e', 'strike'), t('f', 'code')))],
    ['bold then italic, touching', doc(p(t('x', 'bold'), t('y', 'italic')))],
    ['italic then bold, touching', doc(p(t('x', 'italic'), t('y', 'bold')))],
    ['marks across a line break', doc(p(t('a', 'bold'), br, t('- b', 'bold')))],
    ['a link with marks inside', doc(p(t('see '), t('the ', link('https://x.test')), t('rider', link('https://x.test'), 'bold')))],
    ['two links side by side', doc(p(t('a', link('https://a.test')), t('b', link('https://b.test'))))],
    ['a bare link', doc(p(t('go to '), t('https://x.test/a', link('https://x.test/a')), t(' now')))],
    ['a link with brackets in its text', doc(p(t('[draft] mix', link('https://x.test'))))],
    ['every heading level', doc(...[1, 2, 3, 4, 5, 6].map((level) => ({ type: 'heading', attrs: { level }, content: [t(`H${level}`)] })))],
    ['a nested list', doc(bullets([p(t('a')), bullets([p(t('a1'))], [p(t('a2'))])], [p(t('b'))]))],
    ['an ordered list starting at 3, nested in a bullet', doc(bullets([p(t('x')), numbers(3, [p(t('three'))], [p(t('four'))])]))],
    ['a list item with a line break', doc(numbers(1, [p(t('first'), br, t('- still first'))], [p(t('second'))]))],
    ['an empty list item', doc(bullets([p()], [p(t('b'))]))],
    ['a quote', doc({ type: 'blockquote', content: [p(t('one'), br, t('> two')), p(t('three'))] })],
    ['a code block, with markup left alone', doc({ type: 'codeBlock', attrs: { language: 'js' }, content: [t('const a = *b*;\n\n- not a list')] })],
    ['an empty code block', doc({ type: 'codeBlock', attrs: { language: null } })],
    ['a rule between paragraphs', doc(p(t('above')), { type: 'horizontalRule' }, p(t('below')))],
    ['leading spaces', doc(p(t('  indented')), bullets([p(t('item'), br, t('   spaced'))]))],
    ['lines that look like blocks', doc(p(t('# not a heading'), br, t('> not a quote'), br, t('---'), br, t('```')))],
    ['backslashes', doc(p(t('C:\\Users\\band \\* \\\\')))],
  ])('%s', (_name, note) => roundTrips(note));

  /**
   * Random documents over an alphabet that is mostly markup and escapes, so
   * the cases nobody would write by hand get written anyway. Seeded, so a
   * failure reproduces.
   */
  it('survives 500 random documents', () => {
    let seed = 1234567;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
    const alphabet = ['a', 'b', ' ', '  ', '\t', '*', '**', '~', '~~', '`', '[', ']', '(', ')', '\\', '#', '-', '1.', '>', 'https://x.test'];
    const word = () =>
      Array.from({ length: 1 + Math.floor(random() * 6) }, () => pick(alphabet)).join('');
    const markSets: (string | NoteMark)[][] = [[], [], ['bold'], ['italic'], ['strike'], ['bold', 'italic'], ['code'], [link('https://y.test')]];
    const inline = (breaks: boolean): NoteNode[] => {
      const nodes: NoteNode[] = [];
      for (let k = 0; k < 1 + Math.floor(random() * 4); k++) {
        if (breaks && k > 0 && random() < 0.15) nodes.push(br);
        const marks = pick(markSets);
        let text = word();
        if (marks.includes('code')) text = text.replace(/`/g, "'");
        nodes.push(t(text, ...marks));
      }
      return nodes;
    };
    const block = (depth: number): NoteNode => {
      const kind = random();
      if (kind < 0.05) return p();
      if (kind < 0.45) return p(...inline(true));
      if (kind < 0.55) return { type: 'heading', attrs: { level: 1 + Math.floor(random() * 6) }, content: inline(false) };
      if (kind < 0.8 && depth < 2) {
        const items = Array.from({ length: 1 + Math.floor(random() * 3) }, () => {
          const item: NoteNode[] = [p(...inline(true))];
          if (random() < 0.25) item.push(block(depth + 1).type.endsWith('List') ? block(depth + 1) : bullets([p(...inline(false))]));
          return item;
        });
        return random() < 0.5 ? bullets(...items) : numbers(1 + Math.floor(random() * 5), ...items);
      }
      if (kind < 0.9) return { type: 'blockquote', content: [p(...inline(true))] };
      return { type: 'horizontalRule' };
    };

    let tested = 0;
    for (let n = 0; n < 500; n++) {
      const note = doc(...Array.from({ length: 1 + Math.floor(random() * 4) }, () => block(0)));
      // Inner lists from `block` can be headings etc.; keep only valid notes.
      if (!isMarkdownEditable(note)) continue;
      tested++;
      const back = normalizeNote(markdownToNote(noteToMarkdown(note)));
      if (JSON.stringify(back) !== JSON.stringify(normalizeNote(note))) {
        // Show the failing case, not just "not equal".
        expect({ markdown: noteToMarkdown(note), back }).toEqual({
          markdown: noteToMarkdown(note),
          back: normalizeNote(note),
        });
      }
    }
    // A generator that drifted into making uneditable notes would pass
    // vacuously; most of these have to have been checked.
    expect(tested).toBeGreaterThan(400);
  });
});

describe('isMarkdownEditable', () => {
  it('accepts what StarterKit makes from the toolbar', () => {
    expect(isMarkdownEditable(doc(p(t('x', 'bold')), bullets([p(t('y'))])))).toBe(true);
    expect(isMarkdownEditable({ type: 'doc' })).toBe(true);
  });

  // Each of these has no spelling in the dialect; editing would lose it.
  it.each<[string, NoteNode]>([
    ['underline', doc(p(t('x', 'underline')))],
    ['an unknown node from a future extension', doc({ type: 'table', content: [] })],
    ['a list inside a quote', doc({ type: 'blockquote', content: [bullets([p(t('x'))])] })],
    ['an empty paragraph inside a quote', doc({ type: 'blockquote', content: [p()] })],
    ['a backtick inside code', doc(p(t('a`b', 'code')))],
    ['code combined with bold', doc(p(t('x', 'code', 'bold')))],
    ['a line break inside a heading', doc({ type: 'heading', attrs: { level: 1 }, content: [t('a'), br, t('b')] })],
    ['roman-numeral numbering', doc({ type: 'orderedList', attrs: { start: 1, type: 'i' }, content: [{ type: 'listItem', content: [p(t('x'))] }] })],
    ['a fence line inside a code block', doc({ type: 'codeBlock', attrs: { language: null }, content: [t('a\n```\nb')] })],
    ['a newline inside a text run', doc(p(t('a\nb')))],
    ['not a document at all', { type: 'paragraph' }],
  ])('refuses %s', (_name, note) => {
    expect(isMarkdownEditable(note)).toBe(false);
  });
});
