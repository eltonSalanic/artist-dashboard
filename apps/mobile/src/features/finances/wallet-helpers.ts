import type { FinanceEntryDto, FinanceSort } from '@artist/shared';
import type { IconName } from '@/components/icon';

/**
 * Each category's icon, the way a banking app marks a transaction: a picture
 * of what it was, so a long list can be scanned without reading every line.
 * Unknown keys (a category added later) fall back to an arrow in or out.
 */
const CATEGORY_ICONS: Record<string, IconName> = {
  SHOW_FEE: { sf: 'music.mic', md: 'mic' },
  MERCH_SALES: { sf: 'tshirt', md: 'checkroom' },
  STREAMING: { sf: 'headphones', md: 'headphones' },
  SYNC: { sf: 'film', md: 'movie' },
  OTHER_INCOME: { sf: 'arrow.down.left', md: 'south-west' },
  GEAR: { sf: 'hifispeaker.fill', md: 'speaker' },
  TRAVEL: { sf: 'fuelpump', md: 'local-gas-station' },
  LODGING: { sf: 'bed.double', md: 'hotel' },
  RECORDING: { sf: 'waveform', md: 'graphic-eq' },
  MARKETING: { sf: 'megaphone', md: 'campaign' },
  REHEARSAL_SPACE: { sf: 'door.left.hand.open', md: 'meeting-room' },
  MERCH_STOCK: { sf: 'shippingbox', md: 'inventory-2' },
  FEES: { sf: 'percent', md: 'percent' },
  OTHER_EXPENSE: { sf: 'arrow.up.right', md: 'north-east' },
};

export function categoryIcon(category: string, kind: 'INCOME' | 'EXPENSE'): IconName {
  return (
    CATEGORY_ICONS[category] ??
    (kind === 'INCOME' ? CATEGORY_ICONS.OTHER_INCOME : CATEGORY_ICONS.OTHER_EXPENSE)
  );
}

/** "Jamie Torres" → "JT", "riley" → "R": the letters on a member's avatar. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** `2026-10` → "October 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export interface EntryGroup {
  /** `YYYY-MM`, or `'all'` when the list isn't in date order. */
  key: string;
  /** "November 2026", or null for a single ungrouped list. */
  title: string | null;
  entries: FinanceEntryDto[];
}

/**
 * A statement's month headings. Only a list sorted by date reads in months:
 * sorted by amount, November and March would interleave, so it stays one group.
 * Keeps the order it's given.
 */
export function groupByMonth(entries: readonly FinanceEntryDto[], sort: FinanceSort): EntryGroup[] {
  if (sort !== 'newest' && sort !== 'oldest') {
    return entries.length ? [{ key: 'all', title: null, entries: [...entries] }] : [];
  }
  const groups: EntryGroup[] = [];
  for (const entry of entries) {
    const key = entry.occurredOn.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, title: monthLabel(key), entries: [entry] });
  }
  return groups;
}

/** A bar's share of the largest one, never so thin it disappears. */
export function barShare(cents: number, maxCents: number): number {
  if (maxCents <= 0 || cents <= 0) return 0;
  return Math.max(0.04, Math.min(1, cents / maxCents));
}
