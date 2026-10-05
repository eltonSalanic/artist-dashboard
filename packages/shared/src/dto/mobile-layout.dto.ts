import { z } from 'zod';
import { WidgetTypes } from '../enums';

const span = z.union([z.literal(1), z.literal(2)]);

export const mobileLayoutItemSchema = z.object({
  widgetType: z.enum(WidgetTypes).refine((type) => type !== 'CALENDAR', {
    message: 'The calendar is a tab, not a card',
  }),
  w: span,
  h: span,
  hidden: z.boolean().optional(),
});

export const mobileLayoutItemsSchema = z
  .array(mobileLayoutItemSchema)
  .refine(
    (items) => new Set(items.map((item) => item.widgetType)).size === items.length,
    { message: 'Each widget can appear only once' },
  )
  // A board showing nothing reads as broken, not as a choice.
  .refine((items) => items.some((item) => !item.hidden), {
    message: 'Keep at least one widget shown',
  });

export const updateMobileLayoutSchema = z.object({ items: mobileLayoutItemsSchema });
export type UpdateMobileLayoutDto = z.infer<typeof updateMobileLayoutSchema>;
