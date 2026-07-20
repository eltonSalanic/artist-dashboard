import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { AuthUser } from './current-user.decorator';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud: string | string[];
}

/**
 * Verifies Supabase-issued access tokens against the project's JWKS
 * endpoint (Supabase signs with asymmetric keys — ES256 locally). Keys are
 * cached and rate-limited. This file is the only place that knows how
 * Supabase signs tokens.
 */
@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `${config.getOrThrow<string>('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }),
      algorithms: ['ES256', 'RS256'],
      ignoreExpiration: false,
      audience: 'authenticated',
    });
  }

  validate(payload: SupabaseJwtPayload): AuthUser {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token is missing subject or email');
    }
    return { userId: payload.sub, email: payload.email };
  }
}
