import type { WidgetType } from '@artist/shared';
import type { IconName } from '@/components/icon';

/**
 * The per-platform half of the widget registry. Titles and palette slots are
 * shared (`WIDGET_META`); icons cannot be, because web draws lucide components
 * and native draws SF Symbols or Material names.
 *
 * Chosen to read as the same idea as web's lucide icon rather than the same
 * picture — `Zap` becomes `bolt.fill`, `Mic2` becomes `music.mic`.
 */
export const WIDGET_ICONS: Record<WidgetType, IconName> = {
  FOCUS: { sf: 'bolt.fill', md: 'bolt' },
  TODOS: { sf: 'checklist', md: 'checklist' },
  MY_TASKS: { sf: 'person.crop.circle.badge.checkmark', md: 'assignment-ind' },
  GOALS: { sf: 'target', md: 'track-changes' },
  SHOWS: { sf: 'music.mic', md: 'mic' },
  NEXT_REHEARSALS: { sf: 'calendar', md: 'event' },
  NEXT_MEETINGS: { sf: 'person.2.fill', md: 'groups' },
  REMINDERS: { sf: 'bell.fill', md: 'notifications' },
  ACTIVITY_FEED: { sf: 'waveform.path.ecg', md: 'timeline' },
  CUSTOM: { sf: 'square.and.pencil', md: 'edit-note' },
  FINANCES: { sf: 'dollarsign.circle.fill', md: 'account-balance-wallet' },
  CALENDAR: { sf: 'calendar', md: 'calendar-month' },
};
