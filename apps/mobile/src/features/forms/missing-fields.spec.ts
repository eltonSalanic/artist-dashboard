import { firstMissing, missingMessage } from './missing-fields';

const title = { name: 'title' };
const amount = { name: 'amount' };

describe('firstMissing', () => {
  it('returns the topmost missing field, not the first listed', () => {
    const fields = [
      { name: 'title', ref: title, missing: false, message: 'Add a title' },
      { name: 'amount', ref: amount, missing: true, message: 'Add an amount' },
    ];
    expect(firstMissing(fields)?.ref).toBe(amount);
  });

  it('keeps the form order when several are missing', () => {
    const fields = [
      { name: 'title', ref: title, missing: true, message: 'Add a title' },
      { name: 'amount', ref: amount, missing: true, message: 'Add an amount' },
    ];
    expect(firstMissing(fields)?.ref).toBe(title);
  });

  it('is null when everything is filled in', () => {
    const filled = { name: 'title', ref: title, missing: false, message: 'Add a title' };
    expect(firstMissing([filled])).toBeNull();
    expect(firstMissing([])).toBeNull();
  });
});

describe('missingMessage', () => {
  const fields = [
    { name: 'title', ref: title, missing: true, message: 'Add a title' },
    { name: 'amount', ref: amount, missing: false, message: 'Add an amount' },
  ];

  it('stays quiet until a save has been tried', () => {
    expect(missingMessage(fields, 'title', false)).toBeNull();
  });

  it('names what an empty field needs after a save', () => {
    expect(missingMessage(fields, 'title', true)).toBe('Add a title');
  });

  it('clears once the field is filled in', () => {
    expect(missingMessage(fields, 'amount', true)).toBeNull();
  });

  it('is null for a field the form did not list', () => {
    expect(missingMessage(fields, 'other', true)).toBeNull();
  });
});
