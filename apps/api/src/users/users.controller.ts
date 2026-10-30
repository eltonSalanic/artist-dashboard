import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  setPasswordSchema,
  updateProfileSchema,
  type SetPasswordDto,
  type UpdateProfileDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BETTER_AUTH, type Auth } from '../auth/auth.tokens';
import { toHeaders } from '../auth/session-auth.guard';
import type { AuthedRequest } from '../common/authed-request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    @Inject(BETTER_AUTH) private readonly auth: Auth,
  ) {}

  @Post('bootstrap')
  bootstrap(@CurrentUser() user: AuthUser) {
    return this.users.bootstrap(user);
  }

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user);
  }

  /** Your name, as bandmates see it. */
  @Patch()
  @HttpCode(204)
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ): Promise<void> {
    await this.users.updateProfile(user, dto);
  }

  /**
   * Sets a first password for someone who joined with an invite code. Better
   * Auth only allows this server-side, and only for an account that has no
   * password yet; it answers anything else with a 400 we pass on.
   */
  @Post('password')
  @HttpCode(204)
  async setPassword(
    @Req() request: AuthedRequest,
    @Body(new ZodValidationPipe(setPasswordSchema)) dto: SetPasswordDto,
  ): Promise<void> {
    await this.auth.api.setPassword({
      body: { newPassword: dto.password },
      headers: toHeaders(request.headers),
    });
  }
}
