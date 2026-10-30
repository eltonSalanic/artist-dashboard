import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BAND_WALL_PLAN,
  isPro,
  type BoardSubscriptionDto,
  type MySubscriptionDto,
  type OwnershipBlock,
  type SubscriptionDto,
  type SubscriptionStatus,
  type SubscriptionStore,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { activeEntitlement } from './revenuecat-customer';
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

const REVENUECAT_API = 'https://api.revenuecat.com/v1';
const REVENUECAT_TIMEOUT_MS = 5_000;

export type WebhookOutcome =
  'applied' | 'duplicate' | 'ignored' | 'unknown_user';

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

  /** Whether this person is subscribed right now (a trial counts). */
  async isSubscribed(userId: string): Promise<boolean> {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true },
    });
    return isPro(subscription);
  }

  /** Whether the band is open: its owner is subscribed. No owner, no access. */
  async isPro(boardId: string): Promise<boolean> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        owner: {
          select: {
            subscription: { select: { status: true, currentPeriodEnd: true } },
          },
        },
      },
    });
    return isPro(board?.owner?.subscription);
  }

  /** True when the board's routes are closed until its owner subscribes. */
  async requiresSubscription(boardId: string): Promise<boolean> {
    if (!this.enforced) return false;
    return !(await this.isPro(boardId));
  }

  /** Of these boards, the ones whose content may be served. */
  async accessibleBoards(boardIds: string[]): Promise<string[]> {
    if (!this.enforced || boardIds.length === 0) return boardIds;
    const boards = await this.prisma.board.findMany({
      where: { id: { in: boardIds } },
      select: {
        id: true,
        owner: {
          select: {
            subscription: { select: { status: true, currentPeriodEnd: true } },
          },
        },
      },
    });
    const open = new Set(
      boards.filter((b) => isPro(b.owner?.subscription)).map((b) => b.id),
    );
    return boardIds.filter((id) => open.has(id));
  }

  /**
   * What stops this person owning a band, if anything. A subscription covers
   * one band; with billing off, nothing stops anyone.
   */
  async ownershipBlock(userId: string): Promise<OwnershipBlock | null> {
    if (!this.enforced) return null;
    if (!(await this.isSubscribed(userId))) return 'NO_SUBSCRIPTION';
    const owned = await this.prisma.board.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    return owned ? 'ALREADY_OWNS_BAND' : null;
  }

  /** The row itself, for a board summary made right after creating a band. */
  subscriptionOf(userId: string) {
    return this.prisma.userSubscription.findUnique({
      where: { userId },
      select: { status: true, currentPeriodEnd: true },
    });
  }

  async getForBoard(
    boardId: string,
    viewerId: string,
  ): Promise<BoardSubscriptionDto> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        ownerId: true,
        owner: { select: { displayName: true, subscription: true } },
      },
    });
    const row = board?.owner?.subscription ?? null;
    const pro = isPro(row);
    const isOwner = !!board?.ownerId && board.ownerId === viewerId;
    return {
      ...toDto(row, pro),
      // Dates and the store are the owner's business; a member only needs to
      // know whether the band is open.
      ...(isOwner
        ? {}
        : {
            store: null,
            productId: null,
            currentPeriodEnd: null,
            willRenew: false,
            isTrial: false,
          }),
      boardId,
      required: this.enforced && !pro,
      isOwner,
      ownerId: board?.ownerId ?? null,
      ownerName: board?.owner?.displayName ?? null,
    };
  }

  async getMine(userId: string): Promise<MySubscriptionDto> {
    const [row, owned, createBlock] = await Promise.all([
      this.prisma.userSubscription.findUnique({ where: { userId } }),
      this.prisma.board.findFirst({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }),
      this.ownershipBlock(userId),
    ]);
    return {
      ...toDto(row, isPro(row)),
      enforced: this.enforced,
      ownedBoardId: owned?.id ?? null,
      createBlock,
    };
  }

  /**
   * Asks RevenueCat directly, for when the app knows about a purchase before
   * the webhook has arrived, or a webhook can't arrive at all. The webhook
   * stays the main path: this only ever adds an active entitlement, so it
   * can't undo a grant or a newer event, and if it can't reach RevenueCat (or
   * has no key) you just get the subscription as it stood.
   */
  async syncFromRevenueCat(userId: string): Promise<MySubscriptionDto> {
    const key = this.config.get<string>('REVENUECAT_SECRET_API_KEY');
    if (key) {
      try {
        await this.applyRevenueCatCustomer(userId, key);
      } catch (error) {
        this.logger.warn(`RevenueCat sync failed: ${String(error)}`);
      }
    }
    return this.getMine(userId);
  }

  private async applyRevenueCatCustomer(userId: string, key: string) {
    const response = await fetch(
      `${REVENUECAT_API}/subscribers/${encodeURIComponent(userId)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(REVENUECAT_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      throw new Error(`RevenueCat answered ${response.status}`);
    }
    const active = activeEntitlement(await response.json(), new Date());
    if (!active) return;

    const fields = {
      status: active.billingIssue
        ? ('GRACE' as const)
        : active.cancelled
          ? ('CANCELLED' as const)
          : ('ACTIVE' as const),
      store: STORES[active.store ?? ''] ?? 'PROMOTIONAL',
      productId: active.productId,
      currentPeriodEnd: active.expiresAt,
      willRenew: !active.cancelled,
      isTrial: active.isTrial,
      revenueCatAppUserId: userId,
    };
    await this.prisma.userSubscription.upsert({
      where: { userId },
      create: { userId, entitlement: BAND_WALL_PLAN.entitlement, ...fields },
      update: fields,
    });
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
      const userIds = await this.usersFor(event, tx);
      await tx.billingWebhookEvent.create({
        data: { id: event.id, type: event.type, userId: userIds[0] },
      });

      if (event.type === 'TRANSFER') {
        return this.transfer(event, tx);
      }
      const status = STATUS_FOR[event.type];
      if (!status || !this.isOurEntitlement(event)) return 'ignored';
      const [userId] = userIds;
      if (!userId) {
        this.logger.warn(
          `RevenueCat ${event.type} ${event.id} names no user we know`,
        );
        return 'unknown_user';
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
        // A free trial is subscribed like a paid period; this only lets the
        // apps say when the free month ends.
        isTrial: event.period_type === 'TRIAL',
        revenueCatAppUserId: userId,
      };
      await tx.userSubscription.upsert({
        where: { userId },
        create: { userId, entitlement: BAND_WALL_PLAN.entitlement, ...fields },
        update: fields,
      });
      return 'applied';
    });
  }

  /**
   * A restore under another account moved the purchase. The event carries no
   * product or period, so the receiving person takes over the sender's row as
   * it stood, and the sender loses access (and any band they own locks).
   */
  private async transfer(
    event: RevenueCatEvent,
    tx: Tx,
  ): Promise<WebhookOutcome> {
    const from = await this.knownUsers(event.transferred_from ?? [], tx);
    const to = await this.knownUsers(event.transferred_to ?? [], tx);
    const source = from.length
      ? await tx.userSubscription.findUnique({ where: { userId: from[0] } })
      : null;

    if (source && to[0]) {
      const fields = {
        entitlement: source.entitlement,
        status: source.status,
        store: source.store,
        productId: source.productId,
        currentPeriodEnd: source.currentPeriodEnd,
        willRenew: source.willRenew,
        isTrial: source.isTrial,
        revenueCatAppUserId: to[0],
      };
      await tx.userSubscription.upsert({
        where: { userId: to[0] },
        create: { userId: to[0], ...fields },
        update: fields,
      });
    }
    if (from.length) {
      await tx.userSubscription.updateMany({
        where: { userId: { in: from } },
        data: { status: 'EXPIRED', willRenew: false },
      });
    }
    return from.length || to.length ? 'applied' : 'unknown_user';
  }

  /** Events with no entitlement list (older API versions) are taken as ours. */
  private isOurEntitlement(event: RevenueCatEvent): boolean {
    const ids = event.entitlement_ids;
    return !ids || ids.includes(BAND_WALL_PLAN.entitlement);
  }

  /**
   * The person this event is about. The app user id is the user's id, but a
   * purchase made before `logIn` lands on an anonymous id that later gets the
   * user's id as an alias, so every id the event names is tried.
   */
  private async usersFor(event: RevenueCatEvent, tx: Tx): Promise<string[]> {
    const ids = [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases ?? []),
    ].filter((id): id is string => !!id);
    return this.knownUsers(ids, tx);
  }

  private async knownUsers(ids: string[], tx: Tx): Promise<string[]> {
    // Not a uuid is not a user, and would make Postgres reject the query.
    const candidates = [...new Set(ids.filter((id) => UUID.test(id)))];
    if (candidates.length === 0) return [];
    const users = await tx.user.findMany({
      where: { id: { in: candidates } },
      select: { id: true },
    });
    const known = new Set(users.map((u) => u.id));
    return candidates.filter((id) => known.has(id));
  }
}

function toDto(
  row: {
    status: SubscriptionStatus;
    store: SubscriptionStore;
    productId: string;
    currentPeriodEnd: Date | null;
    willRenew: boolean;
    isTrial: boolean;
  } | null,
  pro: boolean,
): SubscriptionDto {
  return {
    isPro: pro,
    status: row?.status ?? null,
    store: row?.store ?? null,
    productId: row?.productId ?? null,
    currentPeriodEnd: row?.currentPeriodEnd?.toISOString() ?? null,
    willRenew: row?.willRenew ?? false,
    isTrial: row?.isTrial ?? false,
  };
}

type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];
