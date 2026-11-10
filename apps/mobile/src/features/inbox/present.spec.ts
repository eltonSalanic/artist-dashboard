import type { MentionNotificationDto } from '@artist/api-client';
import { inboxCardContent, inboxWhen, splitAmount } from './present';

const base: MentionNotificationDto = {
  id: 'n1',
  kind: 'MENTION',
  taskId: 't1',
  entryId: null,
  boardId: 'b1',
  boardName: 'Velvet Static',
  actorName: 'Riley Park',
  taskTitle: 'Lock the setlist for Friday',
  excerpt: '@Quinn Ellis can you confirm the key change?',
  createdAt: new Date(2026, 2, 14, 12).toISOString(),
};

describe('splitAmount', () => {
  it('takes the amount off the end', () => {
    expect(splitAmount('Van gas · $86.00')).toEqual({ label: 'Van gas', amount: '$86.00' });
  });

  it('splits on the last dot, so a label keeps its own', () => {
    expect(splitAmount('Motel · two rooms · $189.00')).toEqual({
      label: 'Motel · two rooms',
      amount: '$189.00',
    });
  });

  it('leaves a title with no amount whole', () => {
    expect(splitAmount('Strings · for Sam')).toEqual({ label: 'Strings · for Sam', amount: null });
    expect(splitAmount('Van gas')).toEqual({ label: 'Van gas', amount: null });
  });
});

describe('inboxCardContent', () => {
  it('leads a mention with the comment and keeps the task for the footer', () => {
    const content = inboxCardContent(base);
    expect(content.kind).toBe('Mention');
    expect(content.lead).toBe(base.excerpt);
    expect(content.task).toBe(base.taskTitle);
    expect(content.sentence).toContain('Riley Park mentioned you in “Lock the setlist for Friday”');
  });

  it('leads a mention with no words with its task, once', () => {
    const content = inboxCardContent({ ...base, excerpt: ' ' });
    expect(content.lead).toBe(base.taskTitle);
    expect(content.task).toBeNull();
  });

  it('drops the prefix the label already says from a paid back note', () => {
    const content = inboxCardContent({
      ...base,
      kind: 'PAID_BACK',
      taskId: null,
      taskTitle: 'Paid back: Van gas · $86.00',
      excerpt: 'Riley Park paid you back from the band fund.',
    });
    expect(content).toMatchObject({
      kind: 'Paid back',
      lead: 'Van gas',
      amount: '$86.00',
      detail: 'Riley Park paid you back from the band fund.',
    });
    expect(content.sentence).toContain('Paid back: Van gas · $86.00');
  });

  it('says who paid and that it is owed on a payback', () => {
    const content = inboxCardContent({
      ...base,
      kind: 'PAYBACK',
      taskId: null,
      actorName: 'Jamie Fox',
      taskTitle: 'Keyboard stand and cables · $64.00',
      excerpt: '',
    });
    expect(content).toMatchObject({
      kind: 'Owed',
      lead: 'Keyboard stand and cables',
      amount: '$64.00',
      detail: 'Jamie Fox paid this. Owed back from the band fund.',
    });
  });
});

describe('inboxWhen', () => {
  const now = new Date(2026, 2, 14, 12);
  const ago = (days: number) => new Date(2026, 2, 14 - days, 12).toISOString();

  it('is relative inside a week and a date after it', () => {
    expect(inboxWhen(ago(3), now)).toBe('3d ago');
    // The date's word order is the device's, so only what it must hold.
    expect(inboxWhen(ago(9), now)).toMatch(/\b5\b/);
    expect(inboxWhen(ago(9), now)).not.toContain('ago');
  });
});
