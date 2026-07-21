import { Injectable } from '@nestjs/common';
import type { FocusPeriod, SetFocusDto } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FocusService {
  constructor(private readonly prisma: PrismaService) {}

  async list(boardId: string) {
    const pins = await this.prisma.focusPin.findMany({
      where: { boardId },
    });
    return pins.map((pin) => ({
      period: pin.period,
      text: pin.text,
      updatedAt: pin.updatedAt,
    }));
  }

  /** Upserts the pin for a period; empty text clears it. */
  async set(boardId: string, period: FocusPeriod, dto: SetFocusDto) {
    if (dto.text === '') {
      await this.prisma.focusPin.deleteMany({ where: { boardId, period } });
      return { period, text: '' };
    }
    const pin = await this.prisma.focusPin.upsert({
      where: { boardId_period: { boardId, period } },
      create: { boardId, period, text: dto.text },
      update: { text: dto.text },
    });
    return { period: pin.period, text: pin.text, updatedAt: pin.updatedAt };
  }
}
