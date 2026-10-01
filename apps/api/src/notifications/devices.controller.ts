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

  // Both return a body rather than void. `apiFetch` calls `response.json()`
  // unconditionally, so an empty 200 would reject with a parse error on a write
  // that actually succeeded — which is why every other endpoint here returns an
  // object too.
  @Post()
  async register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(registerDeviceSchema)) dto: RegisterDeviceDto,
  ) {
    await this.devices.register(user.userId, dto);
    return { registered: true };
  }

  @Delete(':token')
  async unregister(
    @CurrentUser() user: AuthUser,
    @Param('token') token: string,
  ) {
    await this.devices.unregister(user.userId, token);
    return { unregistered: true };
  }
}
