import { DEFAULT_FINANCE_FILTERS } from '@artist/shared';
import {
  clearFilters,
  toggleCategory,
  toggleKind,
  toggleMember,
  togglePayback,
} from './quick-filter-logic';

const base = DEFAULT_FINANCE_FILTERS;

it('turns a type on, and off again', () => {
  const on = toggleKind(base, 'EXPENSE');
  expect(on.kind).toBe('EXPENSE');
  expect(toggleKind(on, 'EXPENSE').kind).toBe('all');
});

it('drops a category and the payback filter that income could never match', () => {
  const next = toggleKind({ ...base, category: 'GEAR', payback: 'owed' }, 'INCOME');
  expect(next).toMatchObject({ kind: 'INCOME', category: 'all', payback: 'all' });
});

it('keeps a category that fits the new type', () => {
  expect(toggleKind({ ...base, category: 'GEAR' }, 'EXPENSE').category).toBe('GEAR');
});

it('shows owed back across expenses when income was picked', () => {
  const next = togglePayback({ ...base, kind: 'INCOME' }, 'owed');
  expect(next).toMatchObject({ kind: 'all', payback: 'owed' });
  expect(togglePayback(next, 'owed').payback).toBe('all');
});

it('adds and removes payers', () => {
  const one = toggleMember(base, 'jamie');
  const two = toggleMember(one, 'band');
  expect(two.members).toEqual(['jamie', 'band']);
  expect(toggleMember(two, 'jamie').members).toEqual(['band']);
});

it('toggles a category', () => {
  const on = toggleCategory(base, 'GEAR');
  expect(on.category).toBe('GEAR');
  expect(toggleCategory(on, 'GEAR').category).toBe('all');
});

it('clears filters but keeps the search and the sort', () => {
  const next = clearFilters({
    ...base,
    kind: 'EXPENSE',
    members: ['jamie'],
    minCents: 100,
    query: 'van',
    sort: 'highest',
  });
  expect(next).toEqual({ ...base, query: 'van', sort: 'highest' });
});
