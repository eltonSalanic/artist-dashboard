import { z } from 'zod';

/** Choosing a password for an account that has none (after an invite code). */
export const setPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Choose a stronger password: at least 8 characters.')
    .max(128),
});
export type SetPasswordDto = z.infer<typeof setPasswordSchema>;

/** Your name as bandmates see it on tasks, shows and the locked band screen. */
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Add your name.').max(60),
});
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
