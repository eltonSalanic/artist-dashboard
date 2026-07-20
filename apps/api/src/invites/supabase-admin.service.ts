import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Thin injectable wrapper around the service-role Supabase client so domain
 * services stay mockable in unit tests. Server-side only — the service-role
 * key must never reach the browser.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly client: SupabaseClient;
  private readonly redirectTo: string;

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
      throw error;
    }
    return 'sent';
  }
}
