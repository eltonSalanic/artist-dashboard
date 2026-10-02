import { Injectable } from '@nestjs/common';
import type { RegisterDeviceDto } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Expo push tokens, one row per install.
 *
 * Deliberately not board-scoped: a token belongs to a phone, and a phone
 * belongs to a person who may be in several bands. Which boards a notification
 * may come from is a preference question, answered by NotificationPreference.
 *
 * `lastSeenAt` is written on every registration but nothing reads it yet —
 * there is no prune job. Dead tokens are removed reactively instead, when Expo
 * answers a send with DeviceNotRegistered, which covers the case that actually
 * matters (an app deleted or permissions revoked). A sweep over `lastSeenAt`
 * would only catch installs that stopped opening *without* being uninstalled,
 * and those still accept pushes.
 */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claims a device for the caller: the newest registration wins, and any other
   * account's row for the same token is removed.
   *
   * Two things are being balanced, and neither can be had for free, because
   * nothing here can distinguish a legitimate handover from someone who has
   * merely learned a token.
   *
   * - **Leave other rows in place** and a device handed from B to A keeps
   *   delivering *B's* notification content — titles and bodies — to A's lock
   *   screen until B happens to sign out from a phone they no longer hold.
   * - **Remove them**, as here, and anyone who knows B's token can take it,
   *   which stops B's notifications.
   *
   * The first is a live content leak on an ordinary action. The second needs an
   * attacker who already has a token that exists only on B's device and in this
   * API — by which point they very likely have B's session anyway. So the leak
   * is the one worth closing.
   *
   * The delete and the upsert go in one transaction: between them the device
   * belongs to nobody, and a notification resolving recipients in that window
   * would silently skip a phone that is in fact registered.
   */
  async register(userId: string, dto: RegisterDeviceDto): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.deviceToken.deleteMany({
        where: { token: dto.token, userId: { not: userId } },
      });
      // The same install reopening the app must touch one row rather than add
      // another, or a notification would arrive once per launch the user ever
      // made.
      await tx.deviceToken.upsert({
        where: { userId_token: { userId, token: dto.token } },
        create: { userId, token: dto.token, platform: dto.platform },
        update: { platform: dto.platform, lastSeenAt: new Date() },
      });
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
