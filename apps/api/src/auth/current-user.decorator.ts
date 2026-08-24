import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from '../common/authed-request';

export interface AuthUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>();
    return request.user as AuthUser;
  },
);
