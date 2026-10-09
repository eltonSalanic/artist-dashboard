import { splitFileName, withExtension } from './file-name';

describe('splitFileName', () => {
  it('splits at the last dot', () => {
    expect(splitFileName('rider.v2.pdf')).toEqual({ base: 'rider.v2', extension: '.pdf' });
  });

  it('leaves names without a usable extension whole', () => {
    expect(splitFileName('setlist')).toEqual({ base: 'setlist', extension: '' });
    expect(splitFileName('.env')).toEqual({ base: '.env', extension: '' });
    expect(splitFileName('draft.')).toEqual({ base: 'draft.', extension: '' });
  });
});

describe('withExtension', () => {
  it('puts the original extension back on the typed name', () => {
    expect(withExtension('  Stage plot ', '.pdf')).toBe('Stage plot.pdf');
  });

  it('does not double an extension the person typed themselves', () => {
    expect(withExtension('Stage plot.PDF', '.pdf')).toBe('Stage plot.PDF');
  });

  it('refuses an empty name', () => {
    expect(withExtension('   ', '.pdf')).toBeNull();
  });

  it('keeps the whole name within 255 characters', () => {
    const name = withExtension('x'.repeat(300), '.wav');
    expect(name).toHaveLength(255);
    expect(name?.endsWith('.wav')).toBe(true);
  });
});
