import { z } from 'zod';

/**
 * Widest range the calendar will answer, in days.
 *
 * A month grid asks for about six weeks; a year view for about 366. Beyond
 * that there is no view, only a way to ask one request to read a board's
 * entire history across four tables with no pagination — and since the range
 * now fans out over every board the caller belongs to, that cost multiplies by
 * their membership count.
 */
export const CALENDAR_MAX_SPAN_DAYS = 370;

const DAY_MS = 24 * 60 * 60 * 1000;

export const calendarQuerySchema = z
  .object({
    /** Inclusive start of the visible range. */
    from: z.iso.datetime(),
    /** Exclusive end of the visible range. */
    to: z.iso.datetime(),
  })
  // Compared as instants, not as strings. `z.iso.datetime()` yields a string,
  // and lexicographic order only matches chronological order while both have
  // the same precision: `…T00:00:00.000Z` vs `…T00:00:00Z` denote the same
  // moment but compare '.' against 'Z'.
  .refine((q) => new Date(q.to) > new Date(q.from), {
    message: 'to must be after from',
    path: ['to'],
  })
  .refine(
    (q) =>
      new Date(q.to).getTime() - new Date(q.from).getTime() <=
      CALENDAR_MAX_SPAN_DAYS * DAY_MS,
    {
      message: `range must not exceed ${CALENDAR_MAX_SPAN_DAYS} days`,
      path: ['to'],
    },
  );
export type CalendarQueryDto = z.infer<typeof calendarQuerySchema>;

/**
 * Optional single-board filter for the cross-board routes.
 *
 * Only ever *narrows* the guard-resolved board set — the handlers intersect
 * with it rather than substituting it, so an id the caller is not a member of
 * yields nothing instead of reaching another band's data. That is the same
 * shape `attachmentQuerySchema`'s `taskId`/`commentId` filters already take:
 * ANDed on top of the authorised scope, never in place of it.
 */
export const boardFilterQuerySchema = z.object({
  boardId: z.uuid().optional(),
});
export type BoardFilterQueryDto = z.infer<typeof boardFilterQuerySchema>;

/**
 * The cross-board calendar: the same date window plus the optional board
 * filter.
 *
 * Spelled out rather than intersected with `calendarQuerySchema`, because that
 * one carries `.refine()` and so is a ZodEffects — intersecting it with an
 * object makes unknown-key stripping depend on the order the two halves run,
 * which is a fragile thing to rest a tenancy boundary's input validation on.
 */
export const crossBoardCalendarQuerySchema = z
  .object({
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    boardId: z.uuid().optional(),
  })
  .refine((q) => new Date(q.to) > new Date(q.from), {
    message: 'to must be after from',
    path: ['to'],
  })
  .refine(
    (q) =>
      new Date(q.to).getTime() - new Date(q.from).getTime() <=
      CALENDAR_MAX_SPAN_DAYS * DAY_MS,
    {
      message: `range must not exceed ${CALENDAR_MAX_SPAN_DAYS} days`,
      path: ['to'],
    },
  );
export type CrossBoardCalendarQueryDto = z.infer<
  typeof crossBoardCalendarQuerySchema
>;
