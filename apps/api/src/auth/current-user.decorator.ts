import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from '../common/authed-request';

export interface AuthUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    // Checked rather than cast. `AuthedRequest.user` is optional, and an
    // unchecked `as AuthUser` launders that away: on a route that is
    // accidentally @Public() the handler receives undefined typed as AuthUser
    // and dies on the first property access, several frames from the cause.
    // Fails closed either way; this way it says what went wrong.
    if (!request.user) {
      throw new Error(
        'CurrentUser() used on a route with no authenticated user — is it @Public()?',
      );
    }
    return request.user;
  },
);
