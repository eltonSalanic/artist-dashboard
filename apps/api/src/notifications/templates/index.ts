import { renderLayout } from './layout';

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateContext {
  boardName: string;
  webUrl: string;
  unsubscribeUrl: string;
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

export const templates: Record<string, TemplateRenderer> = {
  diagnostic,
};
