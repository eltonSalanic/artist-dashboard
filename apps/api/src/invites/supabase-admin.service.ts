import { HttpStatus, HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

/**
 * Thin injectable wrapper around the service-role Supabase client so domain
 * services stay mockable in unit tests. Server-side only — the service-role
 * key must never reach the browser.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly client: ReturnType<typeof createClient>;
  private readonly redirectTo: string;
  private readonly logger = new Logger(SupabaseAdminService.name);

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    this.redirectTo = `${config.get<string>('WEB_URL') ?? 'http://localhost:3000'}/auth/callback`;
  }

  /**
   * Sends a Supabase invite email. Returns 'already_registered' when the
   * email belongs to an existing auth user — not an error for our flow: the
   * pending Invite row is matched by email on their next login.
   */
  async inviteByEmail(email: string): Promise<'sent' | 'already_registered'> {
    const { error } = await this.client.auth.admin.inviteUserByEmail(email, {
      redirectTo: this.redirectTo,
    });
    if (error) {
      if (error.code === 'email_exists') return 'already_registered';
      // Rate limits and SMTP failures used to surface as a bare 500. Log the
      // real cause (no address: it's personal data) and tell the user what
      // happened instead.
      this.logger.error(
        `Invite email failed: ${error.code ?? 'unknown'} (status ${error.status ?? '?'}): ${error.message}`,
      );
      throw new HttpException(
        {
          message:
            "Couldn't send the invite email. Try again in a few minutes.",
          code: 'INVITE_EMAIL_FAILED',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    return 'sent';
  }
}
