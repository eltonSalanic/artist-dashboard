import { z } from 'zod';
import { BoardRoles } from '../enums';

export const createInviteSchema = z.object({
  email: z.email(),
  role: z.enum(BoardRoles).default('USER'),
});
export type CreateInviteDto = z.infer<typeof createInviteSchema>;
