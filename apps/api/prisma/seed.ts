/**
 * Demo seed — fills one rich, lived-in board so the app can be demoed or
 * manually tested without clicking everything into existence by hand.
 *
 *   npm run db:seed            (from apps/api, or `-w apps/api` from root)
 *
 * Target: if a real user exists with DEMO_OWNER_EMAIL (default the smoke-test
 * account), the seed fills the board `/me` shows them — their oldest membership
 * — and renames it "Neon Harbor", so they log in and land right on it. The app
 * is single-board (no switcher), which is why we reuse their board rather than
 * creating a second one they'd never see. If no such account exists, a
 * standalone synthetic board (fixed id, synthetic admin) is built instead.
 *
 * Idempotent, but destructive to that board's *content*: every run wipes the
 * board's tasks/goals/events/reminders/focus/comments/activity (memberships,
 * statuses, and personal layouts are preserved) and repopulates. Synthetic
 * bandmates are upserted, so reruns never duplicate them.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import {
  ActivityType,
  BoardRole,
  EventType,
  GoalPeriod,
  FocusPeriod,
  Priority,
} from '../generated/prisma/enums';
import { DEFAULT_BOARD_LAYOUT, DEFAULT_TASK_STATUSES } from '@artist/shared';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_BOARD_ID = 'de300000-0000-4000-8000-000000000001';
const DEMO_OWNER_EMAIL =
  process.env.DEMO_OWNER_EMAIL ?? 'elton.salanic@gmail.com';

// Synthetic bandmates. Fixed ids keep reseeds stable; @demo.band emails won't
// collide with real Supabase accounts. These users can't log in (no auth
// identity) — they exist to populate assignees, comments, and the feed.
const BAND = {
  jordan: {
    id: 'de3a0000-0000-4000-8000-000000000001',
    email: 'jordan@demo.band',
    displayName: 'Jordan Vega',
  },
  mia: {
    id: 'de3a0000-0000-4000-8000-000000000002',
    email: 'mia@demo.band',
    displayName: 'Mia Chen',
  },
  diego: {
    id: 'de3a0000-0000-4000-8000-000000000003',
    email: 'diego@demo.band',
    displayName: 'Diego Ramos',
  },
  sam: {
    id: 'de3a0000-0000-4000-8000-000000000004',
    email: 'sam@demo.band',
    displayName: 'Sam Okafor',
  },
};

/** A date `n` days from now (negative = past), at noon local for stable display. */
function days(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d;
}

/** The board's statuses, resolved to the four buckets the seed places tasks in. */
function statusBuckets(statuses: { id: string; name: string; sortOrder: number; isDone: boolean }[]) {
  const byName = new Map(statuses.map((s) => [s.name, s.id]));
  const ordered = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder);
  const done = statuses.find((s) => s.isDone) ?? ordered[ordered.length - 1];
  const at = (i: number) => (ordered[i] ?? ordered[ordered.length - 1]).id;
  return {
    notStarted: byName.get('Not Started') ?? at(0),
    inProgress: byName.get('In Progress') ?? at(1),
    waiting: byName.get('Waiting') ?? at(2),
    done: byName.get('Done') ?? done.id,
  };
}

async function main() {
  // Upsert synthetic bandmates (they populate assignees/comments/feed; they
  // can't log in — no Supabase auth identity backs them).
  for (const m of Object.values(BAND)) {
    await prisma.user.upsert({
      where: { id: m.id },
      update: { email: m.email, displayName: m.displayName },
      create: m,
    });
  }

  // Resolve the target board. If a real account owns DEMO_OWNER_EMAIL, seed into
  // the board `/me` would show them (their oldest membership) — so they log in
  // and land right on it. Otherwise build a standalone synthetic board.
  const realOwner = await prisma.user.findUnique({
    where: { email: DEMO_OWNER_EMAIL },
    include: {
      memberships: {
        orderBy: { createdAt: 'asc' },
        include: { board: { include: { statuses: true } } },
      },
    },
  });

  let boardId: string;
  let owner: { id: string; displayName: string };
  let S: ReturnType<typeof statusBuckets>;

  if (realOwner && realOwner.memberships[0]) {
    // ── Seed into the real owner's existing board ──────────────────────────
    const board = realOwner.memberships[0].board;
    boardId = board.id;
    owner = { id: realOwner.id, displayName: realOwner.displayName };
    console.log(`Seeding into ${DEMO_OWNER_EMAIL}'s board "${board.name}" (${boardId})…`);

    // Wipe the board's existing content so reseeds are clean. Memberships,
    // statuses, and personal layouts are preserved. Deleting tasks cascades
    // their comments, attachments, checklist items, assignees, and subtasks.
    await prisma.mentionNotification.deleteMany({ where: { boardId } });
    await prisma.activity.deleteMany({ where: { boardId } });
    await prisma.task.deleteMany({ where: { boardId } });
    await prisma.goal.deleteMany({ where: { boardId } });
    await prisma.event.deleteMany({ where: { boardId } });
    await prisma.reminder.deleteMany({ where: { boardId } });
    await prisma.focusPin.deleteMany({ where: { boardId } });
    await prisma.customWidgetContent.deleteMany({ where: { boardId } });

    // Give the board a clear demo identity and add the synthetic bandmates as
    // members (so they're valid assignees). The real owner keeps their role.
    await prisma.board.update({ where: { id: boardId }, data: { name: 'Neon Harbor' } });
    for (const m of [BAND.mia, BAND.diego, BAND.sam]) {
      await prisma.membership.upsert({
        where: { boardId_userId: { boardId, userId: m.id } },
        update: {},
        create: { boardId, userId: m.id, role: BoardRole.USER },
      });
    }
    S = statusBuckets(board.statuses);
  } else {
    // ── No real account: build a standalone synthetic board ────────────────
    boardId = DEMO_BOARD_ID;
    owner = { id: BAND.jordan.id, displayName: BAND.jordan.displayName };
    console.log(
      `No ${DEMO_OWNER_EMAIL} account found — building standalone demo board "${DEMO_BOARD_ID}".`,
    );
    await prisma.board.deleteMany({ where: { id: boardId } });
    await prisma.board.create({
      data: { id: boardId, name: 'Neon Harbor', defaultLayout: DEFAULT_BOARD_LAYOUT as object[] },
    });
    await prisma.membership.createMany({
      data: [
        { boardId, userId: BAND.jordan.id, role: BoardRole.ADMIN },
        { boardId, userId: BAND.mia.id, role: BoardRole.USER },
        { boardId, userId: BAND.diego.id, role: BoardRole.USER },
        { boardId, userId: BAND.sam.id, role: BoardRole.USER },
      ],
    });
    const created = [];
    for (const s of DEFAULT_TASK_STATUSES) {
      created.push(await prisma.taskStatus.create({ data: { boardId, ...s } }));
    }
    S = statusBuckets(created);
  }

  // Focus pins.
  await prisma.focusPin.createMany({
    data: [
      { boardId: boardId, period: FocusPeriod.WEEK, text: 'Lock the Summer Kickoff setlist' },
      { boardId: boardId, period: FocusPeriod.MONTH, text: 'Finish mixing “Coastlines”' },
      { boardId: boardId, period: FocusPeriod.YEAR, text: 'Release the debut album' },
    ],
  });

  // Goals.
  const goalAlbum = await prisma.goal.create({
    data: {
      boardId: boardId,
      title: 'Release debut album “Neon Harbor”',
      description: 'Ten tracks, mastered and distributed to all platforms.',
      period: GoalPeriod.YEARLY,
      dueDate: days(150),
    },
  });
  const goalMix = await prisma.goal.create({
    data: {
      boardId: boardId,
      title: 'Finish mixing “Coastlines”',
      period: GoalPeriod.MONTHLY,
      dueDate: days(12),
    },
  });
  await prisma.goal.create({
    data: {
      boardId: boardId,
      title: 'Book three summer shows',
      period: GoalPeriod.MONTHLY,
      completedAt: days(-4),
    },
  });

  // Events.
  const showKickoff = await prisma.event.create({
    data: {
      boardId: boardId,
      type: EventType.SHOW,
      title: 'Summer Kickoff',
      location: 'The Fillmore',
      startsAt: days(10),
      endsAt: days(10),
    },
  });
  const rehearsal = await prisma.event.create({
    data: {
      boardId: boardId,
      type: EventType.REHEARSAL,
      title: 'Full set run-through',
      location: 'Studio B',
      startsAt: days(2),
    },
  });
  await prisma.event.create({
    data: {
      boardId: boardId,
      type: EventType.MEETING,
      title: 'Label sync',
      description: 'Quarterly check-in with the label on release timing.',
      startsAt: days(5),
    },
  });
  await prisma.event.create({
    data: {
      boardId: boardId,
      type: EventType.SHOW,
      title: 'Spring Warm-up',
      location: 'The Echo',
      startsAt: days(-20),
      endsAt: days(-20),
    },
  });

  // Reminders.
  await prisma.reminder.createMany({
    data: [
      { boardId: boardId, title: 'Renew rehearsal space booking', remindAt: days(3) },
      { boardId: boardId, title: 'Submit Coastfest application', remindAt: days(7) },
      { boardId: boardId, title: 'Order new guitar strings', remindAt: days(-2), done: true },
    ],
  });

  // Tasks. Small helper keeps the fractional sortOrder monotonic per column.
  let order = 0;
  const nextOrder = () => (order += 100);

  async function makeTask(input: {
    title: string;
    statusId: string;
    priority?: Priority;
    description?: string;
    dueDate?: Date | null;
    assignees?: string[];
    goalId?: string;
    eventId?: string;
    createdById?: string;
    checklist?: { text: string; done?: boolean }[];
  }) {
    const task = await prisma.task.create({
      data: {
        boardId: boardId,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? Priority.MEDIUM,
        statusId: input.statusId,
        dueDate: input.dueDate ?? null,
        sortOrder: nextOrder(),
        goalId: input.goalId ?? null,
        eventId: input.eventId ?? null,
        createdById: input.createdById ?? owner.id,
        assignees: {
          create: (input.assignees ?? []).map((userId) => ({ userId })),
        },
        checklist: input.checklist
          ? {
              create: input.checklist.map((c, i) => ({
                text: c.text,
                done: c.done ?? false,
                sortOrder: (i + 1) * 100,
              })),
            }
          : undefined,
      },
    });
    return task;
  }

  const setlist = await makeTask({
    title: 'Finalize setlist for Summer Kickoff',
    statusId: S.inProgress,
    priority: Priority.HIGH,
    description: 'Twelve songs, ~55 minutes. Open loud, close with the new single.',
    dueDate: days(8),
    assignees: [BAND.mia.id, BAND.diego.id],
    eventId: showKickoff.id,
    checklist: [
      { text: 'Draft song order', done: true },
      { text: 'Time the full set', done: true },
      { text: 'Pick the encore', done: false },
      { text: 'Share with the band', done: false },
    ],
  });
  await makeTask({
    title: 'Confirm encore song',
    statusId: S.notStarted,
    priority: Priority.MEDIUM,
    assignees: [BAND.mia.id],
    // subtask of the setlist task
  }).then((t) =>
    prisma.task.update({ where: { id: t.id }, data: { parentTaskId: setlist.id } }),
  );

  const master = await makeTask({
    title: 'Master “Coastlines”',
    statusId: S.waiting,
    priority: Priority.HIGH,
    description: 'Waiting on the final mix bounce before mastering.',
    dueDate: days(11),
    assignees: [BAND.sam.id],
    goalId: goalMix.id,
  });

  await makeTask({
    title: 'Rehearse the new bridge section',
    statusId: S.inProgress,
    priority: Priority.MEDIUM,
    dueDate: days(2),
    assignees: [BAND.mia.id, BAND.diego.id, BAND.sam.id],
    eventId: rehearsal.id,
  });
  await makeTask({
    title: 'Design the tour poster',
    statusId: S.notStarted,
    priority: Priority.MEDIUM,
    assignees: [BAND.mia.id],
  });
  await makeTask({
    title: 'Contact venues for fall dates',
    statusId: S.notStarted,
    priority: Priority.LOW,
    assignees: [owner.id],
  });
  await makeTask({
    title: 'Record acoustic demo of “Harbor Lights”',
    statusId: S.waiting,
    priority: Priority.LOW,
    assignees: [BAND.sam.id],
    goalId: goalAlbum.id,
  });
  const bio = await makeTask({
    title: 'Update band bio on socials',
    statusId: S.done,
    priority: Priority.LOW,
    assignees: [BAND.diego.id],
  });
  const merch = await makeTask({
    title: 'Fix broken merch store link',
    statusId: S.done,
    priority: Priority.HIGH,
    assignees: [BAND.diego.id],
  });

  // Comments (with an @mention that spawns a notification).
  const comment = await prisma.comment.create({
    data: {
      boardId: boardId,
      taskId: setlist.id,
      authorId: BAND.diego.id,
      body: `I think we should open with "Undertow" — hits harder. @${BAND.mia.displayName} thoughts?`,
      mentions: [BAND.mia.id],
    },
  });
  await prisma.comment.create({
    data: {
      boardId: boardId,
      taskId: master.id,
      authorId: BAND.sam.id,
      body: 'Final mix bounce is uploading tonight — should be ready to master tomorrow.',
    },
  });

  // Mention notification for Mia.
  await prisma.mentionNotification.create({
    data: {
      boardId: boardId,
      userId: BAND.mia.id,
      taskId: setlist.id,
      actorName: BAND.diego.displayName,
      taskTitle: setlist.title,
      excerpt: comment.body.slice(0, 120),
    },
  });

  // Custom widget (TipTap doc).
  await prisma.customWidgetContent.create({
    data: {
      boardId: boardId,
      title: 'Band Notes',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Green room checklist' }],
          },
          {
            type: 'bulletList',
            content: ['Water + towels', 'Set times taped to the wall', 'Merch float cash'].map(
              (t) => ({
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }],
              }),
            ),
          },
        ],
      },
    },
  });

  // Activity feed — a spread across all eight types, backdated so it reads as
  // history. meta shapes mirror what the feed renderer expects.
  const feed = [
    {
      type: ActivityType.MEMBER_ASSIGNED,
      actorId: BAND.mia.id,
      meta: { joinedBoard: true },
      createdAt: days(-30),
    },
    {
      type: ActivityType.TASK_CREATED,
      actorId: owner.id,
      meta: { taskId: setlist.id, taskTitle: setlist.title, isSubtask: false },
      createdAt: days(-9),
    },
    {
      type: ActivityType.MEMBER_ASSIGNED,
      actorId: owner.id,
      meta: {
        taskId: setlist.id,
        taskTitle: setlist.title,
        memberId: BAND.mia.id,
        memberName: BAND.mia.displayName,
      },
      createdAt: days(-9),
    },
    {
      type: ActivityType.STATUS_CHANGED,
      actorId: BAND.mia.id,
      meta: {
        taskId: setlist.id,
        taskTitle: setlist.title,
        fromStatus: 'Not Started',
        toStatus: 'In Progress',
      },
      createdAt: days(-7),
    },
    {
      type: ActivityType.COMMENT_ADDED,
      actorId: BAND.diego.id,
      meta: { taskId: setlist.id, taskTitle: setlist.title },
      createdAt: days(-6),
    },
    {
      type: ActivityType.FILE_UPLOADED,
      actorId: BAND.sam.id,
      meta: { fileName: 'coastlines-mix-v3.mp3', taskId: master.id, taskTitle: master.title },
      createdAt: days(-5),
    },
    {
      type: ActivityType.TASK_COMPLETED,
      actorId: BAND.diego.id,
      meta: { taskId: bio.id, taskTitle: bio.title },
      createdAt: days(-3),
    },
    {
      type: ActivityType.TASK_COMPLETED,
      actorId: BAND.diego.id,
      meta: { taskId: merch.id, taskTitle: merch.title },
      createdAt: days(-2),
    },
    {
      type: ActivityType.GOAL_COMPLETED,
      actorId: owner.id,
      meta: { goalTitle: 'Book three summer shows' },
      createdAt: days(-4),
    },
    {
      type: ActivityType.MEMBER_REMOVED,
      actorId: owner.id,
      meta: { memberName: 'Alex Rivera', removedFromBoard: true },
      createdAt: days(-1),
    },
  ];
  await prisma.activity.createMany({
    data: feed.map((f) => ({ boardId: boardId, ...f })),
  });

  const counts = await prisma.$transaction([
    prisma.task.count({ where: { boardId: boardId } }),
    prisma.goal.count({ where: { boardId: boardId } }),
    prisma.event.count({ where: { boardId: boardId } }),
    prisma.activity.count({ where: { boardId: boardId } }),
  ]);
  console.log(
    `Done — board "Neon Harbor": ${counts[0]} tasks, ${counts[1]} goals, ${counts[2]} events, ${counts[3]} activity entries.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
