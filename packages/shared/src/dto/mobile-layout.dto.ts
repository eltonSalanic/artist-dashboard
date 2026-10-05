import { z } from 'zod';
import { WidgetTypes } from '../enums';
import { MobileCardSizes } from '../mobile-layout';

export const mobileLayoutItemSchema = z.object({
  widgetType: z.enum(WidgetTypes).refine((type) => type !== 'CALENDAR', {
    message: 'The calendar is a tab, not a card',
  }),
  size: z.enum(MobileCardSizes),
  hidden: z.boolean().optional(),
});

export const updateMobileLayoutSchema = z.object({
  items: z
    .array(mobileLayoutItemSchema)
    .refine(
      (items) => new Set(items.map((item) => item.widgetType)).size === items.length,
      { message: 'Each widget can appear only once' },
    )
    // A board showing nothing reads as broken, not as a choice.
    .refine((items) => items.some((item) => !item.hidden), {
      message: 'Keep at least one widget shown',
    }),
});
export type UpdateMobileLayoutDto = z.infer<typeof updateMobileLayoutSchema>;
