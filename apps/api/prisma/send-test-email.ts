/**
 * Queues one diagnostic email and lets the running API's dispatcher pick it up.
 *
 *   npm run mail:test -w apps/api             (to the smoke-test account)
 *   MAIL_TEST_EMAIL=me@example.com npm run mail:test -w apps/api
 *
 * Proves the whole pipe — outbox row, claim, render, transport — without
 * waiting for a real trigger. In dev the mail lands in Mailpit at
 * 127.0.0.1:54324; it only reaches a real inbox with NODE_ENV=production.
 *
 * The API has to be running, since the dispatcher lives there.
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { createPgAdapter } from '../src/prisma/pg-adapter';

const prisma = new PrismaClient({ adapter: createPgAdapter() });

async function main() {
  const email = process.env.MAIL_TEST_EMAIL ?? 'elton.salanic@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    throw new Error(`No user with email ${email} — log in once first.`);

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) throw new Error(`${email} is not a member of any board.`);

  // Unique per run, so repeated tests aren't swallowed by the dedupe index.
  const dedupeKey = `diagnostic:${Date.now()}`;
  await prisma.notificationDelivery.create({
    data: {
      boardId: membership.boardId,
      userId: user.id,
      category: 'MENTIONS',
      template: 'diagnostic',
      dedupeKey,
      payload: { note: `Queued at ${new Date().toISOString()}.` },
    },
  });

  console.log(`Queued ${dedupeKey} for ${email}.`);
  console.log('The API dispatcher sends within ~10s → http://127.0.0.1:54324');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
