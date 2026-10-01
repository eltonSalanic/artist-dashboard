import { z } from 'zod';

/**
 * The categories a person can actually turn off. The database enum also has
 * `DUE_TASKS`, left over from the tasks-due-tomorrow digest that was cut —
 * showing a toggle for a trigger that never fires would be a lie, so the UI
 * and the API both work from this list rather than from the Prisma enum.
 */
export const NotificationCategories = [
  'MENTIONS',
  'ASSIGNMENTS',
  'SCHEDULE',
  'REMINDERS',
] as const;
export type NotificationCategory = (typeof NotificationCategories)[number];

/** One line of copy per category, shared by the settings card and the
 * unsubscribe page so both name the same thing the same way. */
export const NOTIFICATION_CATEGORY_COPY: Record<
  NotificationCategory,
  { label: string; description: string }
> = {
  MENTIONS: {
    label: 'Mentions',
    description: 'When someone @mentions you in a comment.',
  },
  ASSIGNMENTS: {
    label: 'Assignments',
    description: 'When a task is handed to you, or taken off your plate.',
  },
  SCHEDULE: {
    label: 'Schedule',
    description: 'When a show, rehearsal or meeting is added or moved.',
  },
  REMINDERS: {
    label: 'Reminders',
    description: 'When a reminder the band set comes due.',
  },
};

export const updateNotificationPreferenceSchema = z.object({
  category: z.enum(NotificationCategories),
  enabled: z.boolean(),
});
export type UpdateNotificationPreferenceDto = z.infer<
  typeof updateNotificationPreferenceSchema
>;

/** Every category with its current state — absent rows come back as `true`. */
export type NotificationPreferencesDto = Record<NotificationCategory, boolean>;

/** What the unsubscribe page shows after one click. */
export interface UnsubscribeResultDto {
  category: NotificationCategory;
  boardName: string;
}

/** Platforms we mint push tokens for. Mirrors the Prisma `DevicePlatform`. */
export const DevicePlatforms = ['IOS', 'ANDROID'] as const;
export type DevicePlatform = (typeof DevicePlatforms)[number];

/**
 * Registering an install for push. Idempotent on the token: the same install
 * re-registering must update its row, not add another, or one notification
 * would arrive twice.
 */
export const registerDeviceSchema = z.object({
  /** An Expo push token, e.g. `ExponentPushToken[xxxxxxxx]`. */
  token: z.string().trim().min(1).max(256),
  platform: z.enum(DevicePlatforms),
});
export type RegisterDeviceDto = z.infer<typeof registerDeviceSchema>;
