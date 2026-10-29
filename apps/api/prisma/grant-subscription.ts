/**
 * Grants a subscription to boards by hand, as a PROMOTIONAL subscription. For the
 * bands that were on the wall before billing, and for comps.
 *
 *   npm run billing:grant -w apps/api -- <boardId> [<boardId>...]
 *   npm run billing:grant -w apps/api -- --all
 *   npm run billing:grant -w apps/api -- --all --until 2027-06-30
 *
 * `--all` covers every board that doesn't have Pro right now. With no
 * `--until` the grant never ends. A board that already pays through a store
 * is left alone, so a comp never hides a real subscription.
 *
 * This writes our database only; RevenueCat doesn't know about it. A comp
 * granted in the RevenueCat dashboard instead arrives through the webhook as
 * store PROMOTIONAL and does the same thing (docs/billing.md).
 */
import 'dotenv/config';
import { BAND_WALL_PLAN, isPro } from '@artist/shared';
import { PrismaClient } from '../generated/prisma/client';
import { createPgAdapter } from '../src/prisma/pg-adapter';

const prisma = new PrismaClient({ adapter: createPgAdapter() });

function parseArgs(argv: string[]) {
  const ids: string[] = [];
  let all = false;
  let until: Date | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') all = true;
    else if (arg === '--until') {
      until = new Date(`${argv[++i]}T23:59:59Z`);
      if (Number.isNaN(until.getTime()))
        throw new Error('--until wants a date like 2027-06-30');
    } else ids.push(arg);
  }
  if (!all && ids.length === 0)
    throw new Error('Name the boards to grant, or pass --all.');
  return { ids, all, until };
}

async function main() {
  const { ids, all, until } = parseArgs(process.argv.slice(2));
  const boards = await prisma.board.findMany({
    where: all ? {} : { id: { in: ids } },
    select: { id: true, name: true, subscription: true },
  });
  const missing = ids.filter((id) => !boards.some((b) => b.id === id));
  if (missing.length) console.warn(`No such board: ${missing.join(', ')}`);

  let granted = 0;
  for (const board of boards) {
    const sub = board.subscription;
    if (sub && sub.store !== 'PROMOTIONAL' && isPro(sub)) {
      console.log(`skip  ${board.name} (${board.id}): pays via ${sub.store}`);
      continue;
    }
    if (all && isPro(sub)) continue;

    const fields = {
      entitlement: BAND_WALL_PLAN.entitlement,
      status: 'ACTIVE' as const,
      store: 'PROMOTIONAL' as const,
      productId: 'promotional',
      currentPeriodEnd: until,
      willRenew: false,
      revenueCatAppUserId: board.id,
    };
    await prisma.boardSubscription.upsert({
      where: { boardId: board.id },
      create: { boardId: board.id, ...fields },
      update: fields,
    });
    granted++;
    console.log(
      `grant ${board.name} (${board.id}) until ${until?.toISOString() ?? 'forever'}`,
    );
  }
  console.log(`Granted a subscription to ${granted} board(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
