import { Injectable } from '@nestjs/common';
import type { RegisterDeviceDto } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Expo push tokens, one row per install.
 *
 * Deliberately not board-scoped: a token belongs to a phone, and a phone
 * belongs to a person who may be in several bands. Which boards a notification
 * may come from is a preference question, answered by NotificationPreference.
 */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upsert on the token. The same install reopening the app re-registers, and
   * that has to be a no-op plus a timestamp touch — accumulating rows would
   * make one notification arrive once per launch the user ever made.
   *
   * Keyed on the token rather than (userId, token) on purpose: a shared or
   * handed-down device re-registering under a new account must move, not
   * duplicate, or the previous owner would keep receiving the new owner's
   * notifications.
   */
  async register(userId: string, dto: RegisterDeviceDto): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform, lastSeenAt: new Date() },
    });
  }

  /**
   * Sign-out, so the next person on this device is not notified for them.
   * Scoped to the caller's own tokens: without that, knowing a token string
   * would be enough to silence someone else's phone.
   */
  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
  }
}
