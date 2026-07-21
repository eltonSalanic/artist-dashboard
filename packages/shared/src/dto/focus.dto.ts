import { z } from 'zod';
import { FocusPeriods } from '../enums';

export const focusPeriodSchema = z.enum(FocusPeriods);

export const setFocusSchema = z.object({
  /** Empty string clears the pin for that period. */
  text: z.string().trim().max(500),
});
export type SetFocusDto = z.infer<typeof setFocusSchema>;
