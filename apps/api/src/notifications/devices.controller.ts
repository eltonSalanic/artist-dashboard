import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { registerDeviceSchema, type RegisterDeviceDto } from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DevicesService } from './devices.service';

/**
 * A caller's own push registrations. No `@BoardRoles` — a device is not
 * board-scoped, so there is no board id to guard on; every route is pinned to
 * the authenticated user instead.
 */
@Controller('me/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(registerDeviceSchema)) dto: RegisterDeviceDto,
  ) {
    return this.devices.register(user.userId, dto);
  }

  @Delete(':token')
  unregister(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.devices.unregister(user.userId, token);
  }
}
