import { verifyPassword } from 'better-auth/crypto';
import bcrypt from 'bcryptjs';

/**
 * Accounts imported from Supabase Auth keep their bcrypt hashes (`$2a$…`), so
 * their old passwords still work; everything set since then is Better Auth's
 * own scrypt hash. New passwords are always hashed the Better Auth way.
 */
export async function verifyAnyPassword(data: {
  hash: string;
  password: string;
}): Promise<boolean> {
  if (/^\$2[aby]\$/.test(data.hash)) {
    return bcrypt.compare(data.password, data.hash);
  }
  return verifyPassword(data);
}
