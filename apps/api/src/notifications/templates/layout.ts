/**
 * The shell every notification email is poured into. Styles are inline because
 * Gmail discards <style> blocks, and the palette is a hardcoded hex copy of the
 * app's coral/cream identity — email clients don't get CSS custom properties.
 */
export interface LayoutInput {
  /** Shown large at the top of the message. */
  heading: string;
  /** Pre-escaped HTML paragraphs making up the body. */
  bodyHtml: string;
  cta?: { label: string; url: string };
  boardName: string;
  unsubscribeUrl: string;
}

const CORAL = '#e2624a';
const INK = '#2b2724';
const MUTED = '#6f6862';
const CREAM = '#faf6f0';

/** Escapes text destined for HTML. Every template runs its data through this. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLayout(input: LayoutInput): string {
  const cta = input.cta
    ? `<p style="margin:28px 0 0"><a href="${esc(input.cta.url)}" style="display:inline-block;background:${CORAL};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">${esc(input.cta.label)}</a></p>`
    : '';

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK}">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED}">${esc(input.boardName)}</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${esc(input.heading)}</h1>
    <div style="font-size:15px;line-height:1.6;color:${INK}">${input.bodyHtml}</div>
    ${cta}
  </div>
  <p style="max-width:520px;margin:20px auto 0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center">
    You're getting this because you're on ${esc(input.boardName)}.
    <a href="${esc(input.unsubscribeUrl)}" style="color:${MUTED}">Turn these off</a>.
  </p>
</body></html>`;
}
