import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BAND_WALL_PLAN,
  isPro,
  type BoardSubscriptionDto,
  type SubscriptionStatus,
  type SubscriptionStore,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { RevenueCatEvent } from './revenuecat-event';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Our store enum from RevenueCat's. RC_BILLING is Web Billing, which charges
 * through the connected Stripe account. */
const STORES: Record<string, SubscriptionStore> = {
  APP_STORE: 'APP_STORE',
  MAC_APP_STORE: 'APP_STORE',
  PLAY_STORE: 'PLAY_STORE',
  STRIPE: 'STRIPE',
  RC_BILLING: 'STRIPE',
  PROMOTIONAL: 'PROMOTIONAL',
};

/**
 * What each event does to the board's row. Access is never revoked before
 * EXPIRATION: a cancellation only turns auto-renew off, and a billing issue
 * puts the band in GRACE while the store retries.
 */
const STATUS_FOR: Record<string, SubscriptionStatus> = {
  INITIAL_PURCHASE: 'ACTIVE',
  RENEWAL: 'ACTIVE',
  UNCANCELLATION: 'ACTIVE',
  PRODUCT_CHANGE: 'ACTIVE',
  CANCELLATION: 'CANCELLED',
  BILLING_ISSUE: 'GRACE',
  EXPIRATION: 'EXPIRED',
};

export type WebhookOutcome =
  'applied' | 'duplicate' | 'ignored' | 'unknown_board';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * BILLING_ENFORCED=true turns the subscription requirement on. Off by default,
   * so a dev database full of unpaid boards keeps working.
   */
  get enforced(): boolean {
    return this.config.get<string>('BILLING_ENFORCED') === 'true';
  }

  /** Whether the board is subscribed right now (see `isPro` in packages/shared). */
  async isPro(boardId: string): Promise<boolean> {
    const subscription = await this.prisma.boardSubscription.findUnique({
      where: { boardId },
      select: { status: true, currentPeriodEnd: true },
    });
    return isPro(subscription);
  }

  /** True when the board's routes are closed until someone subscribes. */
  async requiresSubscription(boardId: string): Promise<boolean> {
    if (!this.enforced) return false;
    return !(await this.isPro(boardId));
  }

  /** Of these boards, the ones whose content may be served. */
  async accessibleBoards(boardIds: string[]): Promise<string[]> {
    if (!this.enforced || boardIds.length === 0) return boardIds;
    const rows = await this.prisma.boardSubscription.findMany({
      where: { boardId: { in: boardIds } },
      select: { boardId: true, status: true, currentPeriodEnd: true },
    });
    const paid = new Set(rows.filter((r) => isPro(r)).map((r) => r.boardId));
    return boardIds.filter((id) => paid.has(id));
  }

  async getForBoard(boardId: string): Promise<BoardSubscriptionDto> {
    const row = await this.prisma.boardSubscription.findUnique({
      where: { boardId },
    });
    const pro = isPro(row);
    return {
      boardId,
      isPro: pro,
      required: this.enforced && !pro,
      status: row?.status ?? null,
      store: row?.store ?? null,
      productId: row?.productId ?? null,
      currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
      willRenew: row?.willRenew ?? false,
    };
  }

  /**
   * Applies one RevenueCat event. The event id is recorded in the same
   * transaction as the change, so a repeat delivery is skipped, and a failure
   * leaves no record and RevenueCat's retry gets another go.
   *
   * Two copies of one event arriving at once both pass the first check; the
   * second then fails on the event id's unique key, answers 500, and its
   * retry finds the id and is skipped.
   */
  async handleEvent(event: RevenueCatEvent): Promise<WebhookOutcome> {
    const seen = await this.prisma.billingWebhookEvent.findUnique({
      where: { id: event.id },
      select: { id: true },
    });
    if (seen) return 'duplicate';

    return this.prisma.$transaction(async (tx) => {
      const boardIds = await this.boardsFor(event, tx);
      await tx.billingWebhookEvent.create({
        data: { id: event.id, type: event.type, boardId: boardIds[0] },
      });

      if (event.type === 'TRANSFER') {
        return this.transfer(event, tx);
      }
      const status = STATUS_FOR[event.type];
      if (!status || !this.isOurEntitlement(event)) return 'ignored';
      const [boardId] = boardIds;
      if (!boardId) {
        this.logger.warn(
          `RevenueCat ${event.type} ${event.id} names no board we know`,
        );
        return 'unknown_board';
      }

      const fields = {
        status,
        // Anything else (RevenueCat's test store, a store we don't sell
        // on) reads as a grant rather than failing the event.
        store: STORES[event.store ?? ''] ?? 'PROMOTIONAL',
        // Every purchase event names its product; this only keeps the
        // column filled if one ever doesn't.
        productId: event.product_id ?? 'unknown',
        currentPeriodEnd:
          event.expiration_at_ms == null
            ? null
            : new Date(event.expiration_at_ms),
        willRenew: status === 'ACTIVE' || status === 'GRACE',
        revenueCatAppUserId: boardId,
      };
      await tx.boardSubscription.upsert({
        where: { boardId },
        create: { boardId, entitlement: BAND_WALL_PLAN.entitlement, ...fields },
        update: fields,
      });
      return 'applied';
    });
  }

  /**
   * A restore on another board (or another app user) moved the purchase. The
   * event carries no product or period, so the receiving board takes over the
   * sending board's row as it stood, and the sender loses access.
   */
  private async transfer(
    event: RevenueCatEvent,
    tx: Tx,
  ): Promise<WebhookOutcome> {
    const from = await this.knownBoards(event.transferred_from ?? [], tx);
    const to = await this.knownBoards(event.transferred_to ?? [], tx);
    const source = from.length
      ? await tx.boardSubscription.findUnique({ where: { boardId: from[0] } })
      : null;

    if (source && to[0]) {
      const fields = {
        entitlement: source.entitlement,
        status: source.status,
        store: source.store,
        productId: source.productId,
        currentPeriodEnd: source.currentPeriodEnd,
        willRenew: source.willRenew,
        revenueCatAppUserId: to[0],
      };
      await tx.boardSubscription.upsert({
        where: { boardId: to[0] },
        create: { boardId: to[0], ...fields },
        update: fields,
      });
    }
    if (from.length) {
      await tx.boardSubscription.updateMany({
        where: { boardId: { in: from } },
        data: { status: 'EXPIRED', willRenew: false },
      });
    }
    return from.length || to.length ? 'applied' : 'unknown_board';
  }

  /** Events with no entitlement list (older API versions) are taken as ours. */
  private isOurEntitlement(event: RevenueCatEvent): boolean {
    const ids = event.entitlement_ids;
    return !ids || ids.includes(BAND_WALL_PLAN.entitlement);
  }

  /**
   * The board this event is about. The app user id is the board's id, but a
   * purchase made before `logIn` lands on an anonymous id that later gets the
   * board id as an alias, so every id the event names is tried.
   */
  private async boardsFor(event: RevenueCatEvent, tx: Tx): Promise<string[]> {
    const ids = [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases ?? []),
    ].filter((id): id is string => !!id);
    return this.knownBoards(ids, tx);
  }

  private async knownBoards(ids: string[], tx: Tx): Promise<string[]> {
    // Not a uuid is not a board, and would make Postgres reject the query.
    const candidates = [...new Set(ids.filter((id) => UUID.test(id)))];
    if (candidates.length === 0) return [];
    const boards = await tx.board.findMany({
      where: { id: { in: candidates } },
      select: { id: true },
    });
    const known = new Set(boards.map((b) => b.id));
    return candidates.filter((id) => known.has(id));
  }
}

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
