import { joinName } from './full-name';

describe('joinName', () => {
  it('joins first and last with one space', () => {
    expect(joinName('Jess', 'Ortega')).toBe('Jess Ortega');
  });

  it('trims both parts', () => {
    expect(joinName('  Jess ', ' Ortega  ')).toBe('Jess Ortega');
  });

  it('is just the first name when there is no last name', () => {
    expect(joinName('Cher', '')).toBe('Cher');
    expect(joinName('Cher', '   ')).toBe('Cher');
  });

  it('is empty when both are blank', () => {
    expect(joinName(' ', '')).toBe('');
  });
});
