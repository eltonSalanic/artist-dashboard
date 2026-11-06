/**
 * Finance test band: a separate board with five real logins and a few months
 * of realistic money, for trying the finances feature by hand (approvals,
 * payouts, the split, removing a member, CSV export).
 *
 *   npm run db:seed:finances -w apps/api
 *
 * Every account below signs in with TEST_PASSWORD on web and phone. Each one
 * belongs to this board only, so they land straight on it. Local dev only:
 * the emails use the reserved .test domain and the password is a test value.
 *
 * Idempotent and self-contained: each run deletes the "Velvet Static" board
 * (by its fixed id) and rebuilds it, and resets the five accounts' passwords.
 * Nothing else in the database is touched.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { createPgAdapter } from '../src/prisma/pg-adapter';
import {
  BAND_WALL_PLAN,
  DEFAULT_BOARD_LAYOUT,
  DEFAULT_SHOW_STATUSES,
  DEFAULT_TASK_STATUSES,
  formatMoney,
  localDayISO,
} from '@artist/shared';

const prisma = new PrismaClient({ adapter: createPgAdapter() });

/** Test-only password shared by every account below. */
export const TEST_PASSWORD = 'velvet-static-test';

const BOARD_ID = 'f1a00000-0000-4000-8000-000000000001';

const PEOPLE = {
  riley: {
    id: 'f1a10000-0000-4000-8000-000000000001',
    email: 'riley@bandwall.test',
    displayName: 'Riley Park',
    role: 'ADMIN',
    note: 'Owner and admin. Vocals.',
  },
  casey: {
    id: 'f1a10000-0000-4000-8000-000000000002',
    email: 'casey@bandwall.test',
    displayName: 'Casey Morgan',
    role: 'ADMIN',
    note: 'Second admin (guitar), for two-admin tests like approving at once.',
  },
  jamie: {
    id: 'f1a10000-0000-4000-8000-000000000003',
    email: 'jamie@bandwall.test',
    displayName: 'Jamie Torres',
    role: 'USER',
    note: 'Member (drums). Has the $50 van tire waiting for approval.',
  },
  avery: {
    id: 'f1a10000-0000-4000-8000-000000000004',
    email: 'avery@bandwall.test',
    displayName: 'Avery Brooks',
    role: 'USER',
    note: 'Member (bass). Fronted the motel, partly paid back.',
  },
  quinn: {
    id: 'f1a10000-0000-4000-8000-000000000005',
    email: 'quinn@bandwall.test',
    displayName: 'Quinn Ellis',
    role: 'USER',
    note: 'Member (keys). Holds merch cash; try removing them.',
  },
} as const;
type Person = keyof typeof PEOPLE;

/** Noon `n` days from today (negative is the past). */
function days(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}
/** A date-only column value `n` days from today. */
const day = (n: number) => new Date(`${localDayISO(days(n))}T00:00:00.000Z`);

async function upsertAccount(p: (typeof PEOPLE)[Person], hash: string) {
  await prisma.authUser.upsert({
    where: { id: p.id },
    update: { name: p.displayName, email: p.email, emailVerified: true },
    create: {
      id: p.id,
      name: p.displayName,
      email: p.email,
      emailVerified: true,
    },
  });
  await prisma.authAccount.deleteMany({
    where: { userId: p.id, providerId: 'credential' },
  });
  await prisma.authAccount.create({
    data: {
      id: `${p.id}-credential`,
      accountId: p.id,
      providerId: 'credential',
      userId: p.id,
      password: hash,
    },
  });
  await prisma.user.upsert({
    where: { id: p.id },
    update: { email: p.email, displayName: p.displayName },
    create: { id: p.id, email: p.email, displayName: p.displayName },
  });
}

async function main() {
  // bcrypt hashes are accepted by verifyAnyPassword (src/auth/password.ts).
  const hash = bcrypt.hashSync(TEST_PASSWORD, 10);
  for (const p of Object.values(PEOPLE)) await upsertAccount(p, hash);

  // The owner needs a subscription so the board stays open when billing is
  // enforced. A promotional grant, like `npm run billing:grant`.
  const sub = {
    entitlement: BAND_WALL_PLAN.entitlement,
    status: 'ACTIVE' as const,
    store: 'PROMOTIONAL' as const,
    productId: 'promotional',
    currentPeriodEnd: null,
    willRenew: false,
    isTrial: false,
    revenueCatAppUserId: PEOPLE.riley.id,
  };
  await prisma.userSubscription.upsert({
    where: { userId: PEOPLE.riley.id },
    update: sub,
    create: { userId: PEOPLE.riley.id, ...sub },
  });

  // Rebuild the board from scratch. Deleting it cascades everything on it.
  await prisma.board.deleteMany({ where: { id: BOARD_ID } });
  await prisma.board.create({
    data: {
      id: BOARD_ID,
      name: 'Velvet Static',
      currency: 'USD',
      defaultLayout: DEFAULT_BOARD_LAYOUT as unknown as Prisma.InputJsonValue,
      owner: { connect: { id: PEOPLE.riley.id } },
      statuses: { create: DEFAULT_TASK_STATUSES },
      showStatuses: { create: DEFAULT_SHOW_STATUSES },
    },
  });
  // Joined over the past few months, owner first.
  const joined: Record<Person, number> = {
    riley: -120,
    casey: -118,
    jamie: -110,
    avery: -110,
    quinn: -95,
  };
  for (const [key, p] of Object.entries(PEOPLE) as [
    Person,
    (typeof PEOPLE)[Person],
  ][]) {
    await prisma.membership.create({
      data: {
        boardId: BOARD_ID,
        userId: p.id,
        role: p.role,
        createdAt: days(joined[key]),
      },
    });
  }

  const statuses = await prisma.showStatus.findMany({
    where: { boardId: BOARD_ID },
  });
  const status = (name: string) => {
    const s = statuses.find((x) => x.name === name);
    if (!s) throw new Error(`Seed: show status "${name}" missing`);
    return s.id;
  };

  // Shows: three played and settled, one played but not settled yet (the one
  // whose fee is still expected), and two coming up.
  const show = (title: string, location: string, on: number, s: string) =>
    prisma.event.create({
      data: {
        boardId: BOARD_ID,
        type: 'SHOW',
        title,
        location,
        startsAt: days(on),
        endsAt: days(on),
        showStatusId: status(s),
      },
    });
  const echo = await show('Album teaser night', 'The Echo', -75, 'Confirmed');
  const bottom = await show(
    'Northbound tour: SF',
    'Bottom of the Hill',
    -48,
    'Confirmed',
  );
  const sacramento = await show(
    'Northbound tour: Sacramento',
    'Harlow’s',
    -46,
    'Confirmed',
  );
  const parkside = await show(
    'Thursday residency',
    'Thee Parkside',
    -5,
    'Confirmed',
  );
  const fillmore = await show(
    'Fall headliner',
    'The Fillmore',
    12,
    'Confirmed',
  );
  await show('Harvest Fest', 'Golden Gate Park', 33, 'Hold');

  // The saved split: 10% band fund, 18% each.
  const members = Object.values(PEOPLE).map((p) => p.id);
  const split: { userId: string | null; shareBps: number }[] = [
    { userId: null, shareBps: 1000 },
    ...members.map((userId) => ({ userId, shareBps: 1800 })),
  ];
  await prisma.splitShare.createMany({
    data: split.map((s) => ({ boardId: BOARD_ID, ...s })),
  });

  type Line = {
    kind: 'INCOME' | 'EXPENSE';
    category: string;
    amountCents: number;
    on: number;
    description: string;
    counterparty?: string;
    event?: { id: string };
    /** Whose own money it went through. Omitted: the band account. */
    handledBy?: Person;
    by?: Person;
    state?: 'EXPECTED' | 'PENDING' | 'SETTLED' | 'VOID';
    approvedBy?: Person;
    note?: string;
  };
  const ledger: Line[] = [
    // ── About 2½ months ago: teaser show and recording ───────────────────
    {
      kind: 'EXPENSE',
      category: 'REHEARSAL_SPACE',
      amountCents: 40_000,
      on: -88,
      description: 'Rehearsal room, monthly',
      counterparty: 'Soundcheck Studios',
    },
    {
      kind: 'EXPENSE',
      category: 'RECORDING',
      amountCents: 120_000,
      on: -82,
      description: 'Two days tracking “Low Tide”',
      counterparty: 'Tiny Telephone',
    },
    {
      kind: 'INCOME',
      category: 'SHOW_FEE',
      amountCents: 50_000,
      on: -75,
      description: 'Guarantee',
      counterparty: 'The Echo',
      event: echo,
    },
    {
      kind: 'INCOME',
      category: 'MERCH_SALES',
      amountCents: 31_000,
      on: -75,
      description: 'Merch table',
      event: echo,
      handledBy: 'quinn',
      by: 'quinn',
      approvedBy: 'riley',
    },
    {
      kind: 'EXPENSE',
      category: 'FEES',
      amountCents: 7_500,
      on: -75,
      description: 'Door person',
      counterparty: 'The Echo',
      event: echo,
    },
    {
      kind: 'INCOME',
      category: 'STREAMING',
      amountCents: 6_420,
      on: -70,
      description: 'Distributor payout',
      counterparty: 'DistroKid',
    },

    // ── About 1½ months ago: two-night run up north ──────────────────────
    {
      kind: 'EXPENSE',
      category: 'REHEARSAL_SPACE',
      amountCents: 40_000,
      on: -58,
      description: 'Rehearsal room, monthly',
      counterparty: 'Soundcheck Studios',
    },
    {
      kind: 'EXPENSE',
      category: 'MERCH_STOCK',
      amountCents: 36_000,
      on: -55,
      description: '60 tees, 20 totes',
      counterparty: 'Mission Screen Print',
    },
    {
      kind: 'EXPENSE',
      category: 'MARKETING',
      amountCents: 15_000,
      on: -52,
      description: 'Instagram ads for the tour',
      counterparty: 'Meta',
      handledBy: 'casey',
      by: 'casey',
    },
    {
      kind: 'INCOME',
      category: 'SHOW_FEE',
      amountCents: 70_000,
      on: -48,
      description: 'Guarantee',
      counterparty: 'Bottom of the Hill',
      event: bottom,
    },
    {
      kind: 'INCOME',
      category: 'MERCH_SALES',
      amountCents: 42_500,
      on: -48,
      description: 'Merch table',
      event: bottom,
    },
    {
      kind: 'EXPENSE',
      category: 'TRAVEL',
      amountCents: 8_600,
      on: -48,
      description: 'Van gas',
      event: bottom,
      handledBy: 'casey',
      by: 'casey',
    },
    {
      kind: 'EXPENSE',
      category: 'LODGING',
      amountCents: 18_900,
      on: -47,
      description: 'Motel, two rooms',
      event: bottom,
      handledBy: 'avery',
      by: 'avery',
      approvedBy: 'riley',
    },
    {
      kind: 'INCOME',
      category: 'SHOW_FEE',
      amountCents: 45_000,
      on: -46,
      description: 'Door deal, 70%',
      counterparty: 'Harlow’s',
      event: sacramento,
    },
    {
      kind: 'INCOME',
      category: 'MERCH_SALES',
      amountCents: 18_000,
      on: -46,
      description: 'Merch table',
      event: sacramento,
      handledBy: 'quinn',
      by: 'quinn',
      approvedBy: 'casey',
    },
    {
      kind: 'EXPENSE',
      category: 'TRAVEL',
      amountCents: 7_350,
      on: -46,
      description: 'Van gas home',
      event: sacramento,
    },
    // A duplicate someone voided, so the VOID state has something to show.
    {
      kind: 'EXPENSE',
      category: 'TRAVEL',
      amountCents: 7_350,
      on: -46,
      description: 'Van gas home (duplicate)',
      event: sacramento,
      state: 'VOID',
    },
    {
      kind: 'INCOME',
      category: 'STREAMING',
      amountCents: 9_180,
      on: -40,
      description: 'Distributor payout',
      counterparty: 'DistroKid',
    },

    // ── Last few weeks ───────────────────────────────────────────────────
    {
      kind: 'EXPENSE',
      category: 'REHEARSAL_SPACE',
      amountCents: 40_000,
      on: -28,
      description: 'Rehearsal room, monthly',
      counterparty: 'Soundcheck Studios',
    },
    {
      kind: 'INCOME',
      category: 'SYNC',
      amountCents: 150_000,
      on: -21,
      description: '“Low Tide” in a skate brand ad',
      counterparty: 'Northshore Sync',
    },
    {
      kind: 'EXPENSE',
      category: 'FEES',
      amountCents: 22_500,
      on: -21,
      description: 'Sync agent, 15%',
      counterparty: 'Northshore Sync',
    },
    {
      kind: 'EXPENSE',
      category: 'GEAR',
      amountCents: 6_400,
      on: -14,
      description: 'Keyboard stand and cables',
      handledBy: 'quinn',
      by: 'quinn',
      approvedBy: 'casey',
    },
    {
      kind: 'INCOME',
      category: 'STREAMING',
      amountCents: 11_240,
      on: -9,
      description: 'Distributor payout',
      counterparty: 'DistroKid',
    },
    // Last Thursday at Thee Parkside: the fee is still expected, ready to settle.
    {
      kind: 'INCOME',
      category: 'SHOW_FEE',
      amountCents: 60_000,
      on: -5,
      description: 'Guarantee',
      counterparty: 'Thee Parkside',
      event: parkside,
      state: 'EXPECTED',
    },
    // The tire on the way there, waiting for an admin.
    {
      kind: 'EXPENSE',
      category: 'TRAVEL',
      amountCents: 5_000,
      on: -5,
      description: 'Van tire on the way to the show',
      event: parkside,
      handledBy: 'jamie',
      by: 'jamie',
      state: 'PENDING',
      note: 'Blew out on 280, had to buy one at the shop in Daly City.',
    },
    {
      kind: 'EXPENSE',
      category: 'GEAR',
      amountCents: 3_299,
      on: -2,
      description: 'Drumsticks and heads',
      handledBy: 'jamie',
      by: 'jamie',
      state: 'PENDING',
    },

    // ── Coming up ────────────────────────────────────────────────────────
    {
      kind: 'INCOME',
      category: 'SHOW_FEE',
      amountCents: 120_000,
      on: 12,
      description: 'Guarantee',
      counterparty: 'The Fillmore',
      event: fillmore,
      state: 'EXPECTED',
    },
  ];

  const P = (k?: Person) => (k ? PEOPLE[k].id : null);
  const feed: Prisma.ActivityCreateManyInput[] = [];
  for (const line of ledger) {
    const by = line.by ?? 'riley';
    const created = days(Math.min(line.on, 0));
    const entry = await prisma.financeEntry.create({
      data: {
        boardId: BOARD_ID,
        kind: line.kind,
        state: line.state ?? 'SETTLED',
        category: line.category,
        amountCents: line.amountCents,
        occurredOn: day(line.on),
        description: line.description,
        note: line.note ?? '',
        counterparty: line.counterparty ?? null,
        eventId: line.event?.id ?? null,
        handledById: P(line.handledBy),
        createdById: P(by),
        approvedById: P(line.approvedBy),
        approvedAt: line.approvedBy ? days(Math.min(line.on, 0) + 1) : null,
        createdAt: created,
        splits: { create: split },
      },
    });
    if (line.state !== 'VOID') {
      feed.push({
        boardId: BOARD_ID,
        type: 'FINANCE_ENTRY_ADDED',
        actorId: P(by)!,
        createdAt: created,
        meta: {
          entryId: entry.id,
          kind: entry.kind,
          label: entry.description,
          amount: formatMoney(entry.amountCents, 'USD'),
          eventId: entry.eventId,
        },
      });
    }
  }

  // Money that changed hands outside the app. Positive: the band paid them.
  // Negative: they handed money to the band.
  const payouts: { who: Person; cents: number; on: number; note: string }[] = [
    {
      who: 'quinn',
      cents: -31_000,
      on: -73,
      note: 'Echo merch cash, deposited',
    },
    { who: 'avery', cents: 10_000, on: -40, note: 'Motel, part one (Venmo)' },
    { who: 'casey', cents: 8_600, on: -44, note: 'Gas back' },
    { who: 'riley', cents: 25_000, on: -20, note: 'Monthly draw' },
    { who: 'casey', cents: 25_000, on: -20, note: 'Monthly draw' },
    { who: 'jamie', cents: 25_000, on: -20, note: 'Monthly draw' },
  ];
  for (const p of payouts) {
    const created = await prisma.payout.create({
      data: {
        boardId: BOARD_ID,
        userId: PEOPLE[p.who].id,
        amountCents: p.cents,
        paidOn: day(p.on),
        note: p.note,
        createdById: PEOPLE.riley.id,
        createdAt: days(p.on),
      },
    });
    feed.push({
      boardId: BOARD_ID,
      type: 'PAYOUT_RECORDED',
      actorId: PEOPLE.riley.id,
      createdAt: days(p.on),
      meta: {
        payoutId: created.id,
        memberName: PEOPLE[p.who].displayName,
        toBand: p.cents < 0,
        amount: formatMoney(Math.abs(p.cents), 'USD'),
      },
    });
  }
  await prisma.activity.createMany({ data: feed });

  console.log('Built "Velvet Static". Every login uses the same password:');
  console.log(`  password: ${TEST_PASSWORD}`);
  for (const p of Object.values(PEOPLE)) {
    console.log(`  ${p.email.padEnd(22)} ${p.role.padEnd(6)} ${p.note}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
