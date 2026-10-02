import { notePreview } from './note-preview';

const doc = (...blocks: unknown[]) => ({ type: 'doc', content: blocks });
const para = (...text: string[]) => ({
  type: 'paragraph',
  content: text.map((t) => ({ type: 'text', text: t })),
});

describe('notePreview', () => {
  it('returns the first paragraph', () => {
    expect(notePreview(doc(para('Load in at 4'), para('Soundcheck at 5')))).toBe(
      'Load in at 4',
    );
  });

  it('joins the text runs a paragraph is split into', () => {
    // TipTap splits a line at every mark boundary, so a bolded word alone
    // produces three runs.
    expect(notePreview(doc(para('Bring ', 'two', ' DI boxes')))).toBe(
      'Bring two DI boxes',
    );
  });

  it('skips leading empty paragraphs', () => {
    expect(notePreview(doc(para(), para(''), para('Finally')))).toBe('Finally');
  });

  it('walks into nested nodes', () => {
    const list = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [para('First item')] },
        { type: 'listItem', content: [para('Second item')] },
      ],
    };
    expect(notePreview(doc(list))).toBe('First item Second item');
  });

  it('walks node types it has never heard of', () => {
    // The document comes from whatever extensions web had enabled; an unknown
    // wrapper must not swallow its contents.
    const exotic = { type: 'someFutureBlock', content: [para('Still here')] };
    expect(notePreview(doc(exotic))).toBe('Still here');
  });

  it('collapses hard breaks and runs of whitespace', () => {
    const block = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'One' },
        { type: 'hardBreak' },
        { type: 'text', text: '  two' },
      ],
    };
    expect(notePreview(doc(block))).toBe('One two');
  });

  it('truncates with an ellipsis rather than mid-card', () => {
    const long = 'word '.repeat(60).trim();
    const preview = notePreview(doc(para(long)), 20);
    expect(preview).toHaveLength(20);
    expect(preview?.endsWith('…')).toBe(true);
  });

  it('returns null for an empty or absent note', () => {
    expect(notePreview(null)).toBeNull();
    expect(notePreview(undefined)).toBeNull();
    expect(notePreview(doc())).toBeNull();
    expect(notePreview(doc(para('')))).toBeNull();
    expect(notePreview({})).toBeNull();
  });

  it('does not throw on a document shaped nothing like one', () => {
    expect(notePreview({ content: 'not an array' })).toBeNull();
    expect(notePreview({ content: [null, 7, 'x'] })).toBeNull();
  });
});
