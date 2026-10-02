import { WidgetTypes, type WidgetType } from './enums';
import type { WidgetColor } from './theme';

/**
 * What a widget is called and which palette slot it ships in.
 *
 * Both of these used to live in `apps/web/src/features/widgets/registry.tsx`
 * alongside the components, which is the natural home right up until a second
 * platform renders the same widgets. A board whose Focus card is coral in the
 * browser and lilac on a phone is the same bug as a palette that drifts, so the
 * two facts that are not platform-specific moved here.
 *
 * Components and icons stay per-platform: web draws lucide, native draws SF
 * Symbols or Material. The *name* and the *colour* are the product's, not the
 * renderer's.
 */
export interface WidgetMeta {
  title: string;
  /**
   * Palette slot this widget ships in; a board can reassign it through
   * `resolveWidgetColor`. Omitted means the neutral card.
   */
  defaultColor?: WidgetColor;
}

export const WIDGET_META: Record<WidgetType, WidgetMeta> = {
  FOCUS: { title: 'Focus', defaultColor: 'c1' },
  TODOS: { title: "To-Do's" },
  MY_TASKS: { title: 'My Tasks' },
  GOALS: { title: 'Goals', defaultColor: 'c2' },
  SHOWS: { title: 'Shows', defaultColor: 'c4' },
  NEXT_REHEARSALS: { title: 'Next Rehearsals' },
  NEXT_MEETINGS: { title: 'Next Meetings' },
  REMINDERS: { title: 'Reminders', defaultColor: 'c3' },
  ACTIVITY_FEED: { title: 'Activity' },
  CUSTOM: { title: 'Notes' },
  // A full page rather than a card on either platform, but listed so this map
  // stays exhaustive over `WidgetType` and a new widget cannot be forgotten.
  CALENDAR: { title: 'Calendar' },
};

/** Widget types that render as a card. `CALENDAR` is a page, not a widget. */
export const CARD_WIDGET_TYPES: readonly WidgetType[] = WidgetTypes.filter(
  (type) => type !== 'CALENDAR',
);
