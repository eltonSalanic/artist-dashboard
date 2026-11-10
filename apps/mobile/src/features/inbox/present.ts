import type { MentionNotificationDto } from '@artist/api-client';
// Relative, not `@/`: jest has no alias map, and this file has a spec.
import { shortAgo, shortDate } from '../board/format';

/**
 * A notification taken apart for a card: the server writes each one as a
 * sentence or two, and a card wants the pieces (kind, who, the words that
 * matter, the amount) so it can set them at different sizes.
 *
 * Nothing is dropped on the way: whatever cannot be taken apart is shown whole.
 */
export interface InboxCardContent {
  /** Small caps over the card: what kind of thing this is. */
  kind: 'Mention' | 'Paid back' | 'Owed';
  /** The card's main text: the comment, or what the money was for. */
  lead: string;
  /** A money note's figure, as the server formatted it ("$86.00"). */
  amount: string | null;
  /** A second, quieter line: who paid and where it comes from. */
  detail: string | null;
  /** The task a mention was left on. Null when `lead` already says it. */
  task: string | null;
  /** The whole notification as one sentence, for a screen reader. */
  sentence: string;
}

const DAY = 24 * 60 * 60_000;
const PAID_BACK_PREFIX = /^paid back:\s*/i;

/**
 * "Van gas · $86.00" as its label and its amount.
 *
 * Split on the last " · " and only when what follows carries a digit, so a
 * label with its own middle dot keeps it and a title with no amount (a format
 * the server may grow) is shown whole instead of losing its tail.
 */
export function splitAmount(text: string): { label: string; amount: string | null } {
  const at = text.lastIndexOf(' · ');
  if (at <= 0) return { label: text.trim(), amount: null };
  const tail = text.slice(at + 3).trim();
  if (!/\d/.test(tail)) return { label: text.trim(), amount: null };
  return { label: text.slice(0, at).trim(), amount: tail };
}

export function inboxCardContent(item: MentionNotificationDto): InboxCardContent {
  const excerpt = item.excerpt.trim();

  if (item.kind === 'MENTION') {
    const sentence = `${item.actorName} mentioned you in “${item.taskTitle}”`;
    return {
      kind: 'Mention',
      // A mention with no words left in it (the comment was only the handle)
      // leads with the task, so the card is never an empty box.
      lead: excerpt === '' ? item.taskTitle : excerpt,
      amount: null,
      detail: null,
      task: excerpt === '' ? null : item.taskTitle,
      sentence: [sentence, excerpt].filter(Boolean).join('. '),
    };
  }

  if (item.kind === 'PAYBACK') {
    const { label, amount } = splitAmount(item.taskTitle);
    const owed = `${item.actorName} paid this. Owed back from the band fund.`;
    return {
      kind: 'Owed',
      lead: label,
      amount,
      detail: [excerpt, owed].filter(Boolean).join(' '),
      task: null,
      sentence: [
        `${item.actorName} paid ${item.taskTitle}`,
        excerpt,
        'Owed back from the band fund',
      ]
        .filter(Boolean)
        .join('. '),
    };
  }

  // PAID_BACK: the server already wrote "Paid back: Van gas · $86.00". The
  // card's label says "paid back", so the prefix would only say it twice.
  const { label, amount } = splitAmount(item.taskTitle.replace(PAID_BACK_PREFIX, ''));
  return {
    kind: 'Paid back',
    lead: label === '' ? item.taskTitle : label,
    amount,
    detail: excerpt === '' ? null : excerpt,
    task: null,
    sentence: [item.taskTitle, excerpt].filter(Boolean).join('. '),
  };
}

/**
 * "12m ago" inside a week, the date after it: past a week "16d ago" makes the
 * reader do the sum, and "24 Oct" does not.
 */
export function inboxWhen(iso: string, now = new Date()): string {
  return now.getTime() - new Date(iso).getTime() < 7 * DAY ? shortAgo(iso, now) : shortDate(iso, now);
}
