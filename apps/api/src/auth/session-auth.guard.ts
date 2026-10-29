import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IncomingHttpHeaders } from 'node:http';
import type { AuthedRequest } from '../common/authed-request';
import { BETTER_AUTH, type Auth } from './auth.tokens';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Global guard: every route needs a live Better Auth session unless it is
 * `@Public()`. The apps send the session token as `Authorization: Bearer …`;
 * Better Auth's bearer plugin looks it up, so a signed-out, expired or revoked
 * session is a 401 on the very next request.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(BETTER_AUTH) private readonly auth: Auth,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const session = await this.auth.api.getSession({
      headers: toHeaders(request.headers),
    });
    if (!session) throw new UnauthorizedException();

    request.user = { userId: session.user.id, email: session.user.email };
    return true;
  }
}

/** Node's header object → the Fetch `Headers` Better Auth expects. */
export function toHeaders(raw: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) {
      headers.append(key, one);
    }
  }
  return headers;
}
