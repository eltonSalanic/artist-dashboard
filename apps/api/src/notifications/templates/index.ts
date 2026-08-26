import { formatDate } from './format';
import { esc, renderLayout } from './layout';

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateContext {
  boardName: string;
  webUrl: string;
  unsubscribeUrl: string;
  /** The board's IANA zone — every rendered timestamp is in it. */
  timezone: string;
}

/**
 * Templates are plain functions of a snapshot payload, never of the database.
 * The payload was frozen when the delivery was queued, so a mail sent minutes
 * later still describes what actually happened.
 */
export type TemplateRenderer = (
  payload: Record<string, unknown>,
  ctx: TemplateContext,
) => RenderedMail;

const str = (payload: Record<string, unknown>, key: string): string =>
  typeof payload[key] === 'string' ? payload[key] : '';

/**
 * Both detail modals are mounted on /dashboard and driven by a search param,
 * so a deep link opens the item directly. See use-detail-params.ts on the web
 * side — these two have to agree.
 */
const taskLink = (webUrl: string, taskId: string) =>
  `${webUrl}/dashboard?task=${encodeURIComponent(taskId)}`;

/**
 * Dev/ops smoke test: proves the whole pipe — queue, claim, render, transport —
 * without waiting for a real trigger. Also the fastest way to check how a real
 * client renders the layout after changing it.
 */
const diagnostic: TemplateRenderer = (payload, ctx) => {
  const note = str(payload, 'note') || 'Nothing to report. The pipe works.';
  return {
    subject: 'Artist Dashboard test email',
    html: renderLayout({
      heading: 'This is a test',
      bodyHtml: `<p style="margin:0">${note}</p>`,
      cta: { label: 'Open the board', url: ctx.webUrl },
      boardName: ctx.boardName,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text: `This is a test\n\n${note}\n\nOpen the board: ${ctx.webUrl}\nTurn these off: ${ctx.unsubscribeUrl}`,
  };
};

/** Trigger 1 — someone @mentioned you in a comment. */
const commentMention: TemplateRenderer = (payload, ctx) => {
  const actorName = str(payload, 'actorName') || 'Someone';
  const taskTitle = str(payload, 'taskTitle') || 'a task';
  const excerpt = str(payload, 'excerpt');
  const url = taskLink(ctx.webUrl, str(payload, 'taskId'));

  return {
    subject: `${actorName} mentioned you on "${taskTitle}"`,
    html: renderLayout({
      heading: `${actorName} mentioned you`,
      bodyHtml: `<p style="margin:0 0 12px">On <strong>${esc(taskTitle)}</strong>:</p>
        <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #e2624a;background:#faf6f0;border-radius:0 8px 8px 0">${esc(excerpt)}</blockquote>`,
      cta: { label: 'Read the comment', url },
      boardName: ctx.boardName,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text: `${actorName} mentioned you on "${taskTitle}":\n\n${excerpt}\n\nRead it: ${url}\nTurn these off: ${ctx.unsubscribeUrl}`,
  };
};

/** Trigger 2 — you were added to a task. */
const taskAssigned: TemplateRenderer = (payload, ctx) => {
  const actorName = str(payload, 'actorName') || 'Someone';
  const taskTitle = str(payload, 'taskTitle') || 'a task';
  const dueDate = str(payload, 'dueDate');
  const url = taskLink(ctx.webUrl, str(payload, 'taskId'));
  const due = dueDate
    ? `<p style="margin:12px 0 0;color:#6f6862">Due ${esc(formatDate(dueDate, ctx.timezone))}.</p>`
    : '';

  return {
    subject: `${actorName} assigned you "${taskTitle}"`,
    html: renderLayout({
      heading: 'You picked up a task',
      bodyHtml: `<p style="margin:0">${esc(actorName)} assigned you <strong>${esc(taskTitle)}</strong>.</p>${due}`,
      cta: { label: 'Open the task', url },
      boardName: ctx.boardName,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text: `${actorName} assigned you "${taskTitle}".${dueDate ? ` Due ${formatDate(dueDate, ctx.timezone)}.` : ''}\n\nOpen it: ${url}\nTurn these off: ${ctx.unsubscribeUrl}`,
  };
};

/** Trigger 3 — you were taken off a task. */
const taskUnassigned: TemplateRenderer = (payload, ctx) => {
  const actorName = str(payload, 'actorName') || 'Someone';
  const taskTitle = str(payload, 'taskTitle') || 'a task';
  const url = taskLink(ctx.webUrl, str(payload, 'taskId'));

  return {
    subject: `You're off "${taskTitle}"`,
    html: renderLayout({
      heading: 'One less thing',
      bodyHtml: `<p style="margin:0">${esc(actorName)} took you off <strong>${esc(taskTitle)}</strong>. Nothing needed from you.</p>`,
      cta: { label: 'See the task', url },
      boardName: ctx.boardName,
      unsubscribeUrl: ctx.unsubscribeUrl,
    }),
    text: `${actorName} took you off "${taskTitle}". Nothing needed from you.\n\nSee it: ${url}\nTurn these off: ${ctx.unsubscribeUrl}`,
  };
};

export const templates: Record<string, TemplateRenderer> = {
  diagnostic,
  'comment-mention': commentMention,
  'task-assigned': taskAssigned,
  'task-unassigned': taskUnassigned,
};
