import { toggleList, toggleWrap } from './editing';

const at = (text: string, start: number, end = start) => ({ text, selection: { start, end } });

describe('toggleWrap', () => {
  it('wraps a selection and keeps it selected', () => {
    expect(toggleWrap('bring two DIs', { start: 6, end: 9 }, '**')).toEqual(at('bring **two** DIs', 8, 11));
  });

  it('unwraps an already wrapped selection', () => {
    expect(toggleWrap('bring **two** DIs', { start: 8, end: 11 }, '**')).toEqual(at('bring two DIs', 6, 9));
  });

  // A double-tapped word on iOS often includes its trailing space.
  it('keeps edge whitespace outside the markers', () => {
    expect(toggleWrap('bring two DIs', { start: 6, end: 10 }, '*').text).toBe('bring *two* DIs');
  });

  it('inserts an empty pair at a caret, with the caret inside', () => {
    expect(toggleWrap('ab', { start: 1, end: 1 }, '~~')).toEqual(at('a~~~~b', 3));
  });

  it('takes an empty pair back out', () => {
    expect(toggleWrap('a~~~~b', { start: 3, end: 3 }, '~~')).toEqual(at('ab', 1));
  });

  it('does not mistake the inside of **bold** for an italic pair', () => {
    expect(toggleWrap('**two**', { start: 2, end: 5 }, '*').text).toBe('***two***');
  });

  it('leaves a whitespace-only selection alone', () => {
    expect(toggleWrap('a   b', { start: 1, end: 4 }, '**')).toEqual(at('a   b', 1, 4));
  });
});

describe('toggleList', () => {
  it('bullets the line under the caret', () => {
    expect(toggleList('milk', { start: 2, end: 2 }, 'bullet')).toEqual(at('- milk', 4));
  });

  it('numbers every selected line from 1', () => {
    expect(toggleList('a\nb\nc', { start: 0, end: 5 }, 'number').text).toBe('1. a\n2. b\n3. c');
  });

  it('takes bullets off when every line has one', () => {
    expect(toggleList('- a\n- b', { start: 0, end: 7 }, 'bullet').text).toBe('a\nb');
  });

  it('swaps numbers for bullets rather than stacking them', () => {
    expect(toggleList('1. a', { start: 3, end: 3 }, 'bullet').text).toBe('- a');
  });

  it('keeps a nested item nested', () => {
    expect(toggleList('- a\n  b', { start: 6, end: 6 }, 'bullet').text).toBe('- a\n  - b');
  });

  it('only touches the lines the selection covers', () => {
    expect(toggleList('top\nmid\nend', { start: 5, end: 5 }, 'bullet').text).toBe('top\n- mid\nend');
  });
});
