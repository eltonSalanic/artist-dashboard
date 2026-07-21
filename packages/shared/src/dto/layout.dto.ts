import { z } from 'zod';
import { WidgetTypes } from '../enums';

export const layoutItemSchema = z.object({
  widgetType: z.enum(WidgetTypes),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  hidden: z.boolean().optional(),
});

export const updateLayoutSchema = z.object({
  layout: z.array(layoutItemSchema),
});
export type UpdateLayoutDto = z.infer<typeof updateLayoutSchema>;
